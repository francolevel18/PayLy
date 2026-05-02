import { normalizeExpenses } from "./expensesStorage";
import {
  categories as expectedCategories,
  getLearningKeyword,
  parseExpenseInput,
  paymentMethods as expectedPaymentMethods
} from "./expenseParser";
import { mergeParserLearning, rememberParserCorrection } from "./parserLearningStorage";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const categoryByKey = new Map();
const paymentMethodByKey = new Map();
let remoteLearningDisabled = false;

export async function loadRemoteExpenses() {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    return [];
  }

  await ensureCatalogCache();

  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, description, raw_text, spent_at, created_at, metadata, credit_card_id, installments, installment_number, statement_month, categories(key), payment_methods(key)")
    .eq("user_id", userId)
    .order("spent_at", { ascending: false });

  if (error) {
    throw error;
  }

  return normalizeExpenses(
    (data || []).map((expense) => ({
      id: expense.id,
      amount: expense.amount,
      category: expense.categories?.key || "other",
      paymentMethod: expense.payment_methods?.key || "cash",
      description: expense.description,
      rawText: expense.raw_text,
      createdAt: expense.spent_at || expense.created_at,
      metadata: normalizeMetadata(expense.metadata),
      syncState: "synced",
      syncedAt: new Date().toISOString(),
      lastSyncError: "",
      creditCardId: expense.credit_card_id,
      installments: expense.installments,
      installmentNumber: expense.installment_number,
      statementMonth: expense.statement_month
    }))
  );
}

export async function retryPendingExpenses(expenses) {
  const pendingExpenses = expenses.filter((expense) => ["pending", "error"].includes(expense.syncState));
  if (pendingExpenses.length === 0) {
    return { syncedIds: [], failed: [] };
  }

  const syncedIds = [];
  const failed = [];

  for (const expense of pendingExpenses) {
    try {
      await saveRemoteExpense(expense);
      syncedIds.push(expense.id);
    } catch (error) {
      failed.push({ id: expense.id, message: error?.message || "No se pudo sincronizar." });
    }
  }

  return { syncedIds, failed };
}

export async function saveRemoteExpense(expense) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    return null;
  }

  await ensureCatalogCache();

  const payload = {
    id: expense.id,
    user_id: userId,
    amount: expense.amount,
    description: expense.description,
    raw_text: expense.rawText,
    category_id: categoryByKey.get(expense.category) || null,
    payment_method_id: paymentMethodByKey.get(expense.paymentMethod) || null,
    spent_at: expense.createdAt,
    currency: "ARS",
    source: "parser",
    credit_card_id: expense.creditCardId || null,
    installments: expense.installments || 1,
    installment_number: expense.installmentNumber || null,
    statement_month: expense.statementMonth || null,
    metadata: buildExpenseMetadata(expense)
  };

  const { error } = await supabase.from("expenses").insert(payload);
  if (error) {
    if (error.code === "23505") {
      return expense;
    }

    throw error;
  }

  return expense;
}

export async function updateRemoteExpense(expense) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    return null;
  }

  await ensureCatalogCache();

  const payload = {
    amount: expense.amount,
    description: expense.description,
    raw_text: expense.rawText,
    category_id: categoryByKey.get(expense.category) || null,
    payment_method_id: paymentMethodByKey.get(expense.paymentMethod) || null,
    spent_at: expense.createdAt,
    currency: "ARS",
    source: "manual_edit",
    credit_card_id: expense.creditCardId || null,
    installments: expense.installments || 1,
    installment_number: expense.installmentNumber || null,
    statement_month: expense.statementMonth || null,
    metadata: buildExpenseMetadata(expense)
  };

  const { error } = await supabase.from("expenses").update(payload).eq("id", expense.id);
  if (error) {
    throw error;
  }

  return expense;
}

export async function learnFromExpenseCorrection(rawText, correctedExpense) {
  if (!rawText) {
    return;
  }

  const keyword = getLearningKeyword(rawText);
  if (!keyword) {
    return;
  }

  const detectedExpense = parseExpenseInput(rawText);
  const learned = rememberParserCorrection(rawText, detectedExpense, correctedExpense);
  if (!learned || !isSupabaseConfigured || remoteLearningDisabled) {
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    return;
  }

  await ensureCatalogCache();
  const learningTasks = [];

  if (correctedExpense.category && correctedExpense.category !== detectedExpense.category) {
    learningTasks.push(
      incrementParserKeyword("parser_keywords", {
        keyword,
        user_id: userId,
        category_id: categoryByKey.get(correctedExpense.category)
      })
    );
  }

  if (correctedExpense.paymentMethod && correctedExpense.paymentMethod !== detectedExpense.paymentMethod) {
    learningTasks.push(
      incrementParserKeyword("parser_payment_method_keywords", {
        keyword,
        user_id: userId,
        payment_method_id: paymentMethodByKey.get(correctedExpense.paymentMethod)
      })
    );
  }

  await Promise.all(learningTasks);
}

async function incrementParserKeyword(tableName, payload) {
  const idColumn = payload.category_id ? "category_id" : "payment_method_id";
  const idValue = payload[idColumn];
  if (!idValue) {
    return;
  }

  const now = new Date().toISOString();
  const { data: existing, error: selectError } = await supabase
    .from(tableName)
    .select("id, count")
    .eq("keyword", payload.keyword)
    .eq("user_id", payload.user_id)
    .eq(idColumn, idValue)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    if (["42P01", "42703", "42501"].includes(selectError.code)) {
      return;
    }
    disableRemoteLearning(selectError);
    return;
  }

  if (existing?.id) {
    const { error } = await supabase
      .from(tableName)
      .update({
        count: Math.max(1, Number(existing.count) || 1) + 1,
        last_used_at: now,
        updated_at: now
      })
      .eq("id", existing.id);

    if (error && !["42P01", "42703", "42501"].includes(error.code)) {
      disableRemoteLearning(error);
    }
    return;
  }

  const { error: insertError } = await supabase
    .from(tableName)
    .insert({
      ...payload,
      count: 1,
      last_used_at: now,
      updated_at: now
    });

  if (!insertError) {
    return;
  }

  if (insertError.code === "23505") {
    const { data: duplicate, error: duplicateSelectError } = await supabase
      .from(tableName)
      .select("id, count")
      .eq("keyword", payload.keyword)
      .eq("user_id", payload.user_id)
      .eq(idColumn, idValue)
      .limit(1)
      .maybeSingle();

    if (duplicateSelectError || !duplicate?.id) {
      if (duplicateSelectError && !["42P01", "42703", "42501"].includes(duplicateSelectError.code)) {
        disableRemoteLearning(duplicateSelectError);
      }
      return;
    }

    const { error } = await supabase
      .from(tableName)
      .update({
        count: Math.max(1, Number(duplicate.count) || 1) + 1,
        last_used_at: now,
        updated_at: now
      })
      .eq("id", duplicate.id);

    if (error && !["42P01", "42703", "42501"].includes(error.code)) {
      disableRemoteLearning(error);
    }
    return;
  }

  if (!["42P01", "42703", "42501"].includes(insertError.code)) {
    disableRemoteLearning(insertError);
  }
}

export async function loadRemoteParserLearning() {
  if (!isSupabaseConfigured || remoteLearningDisabled) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    return null;
  }

  try {
    const [categoryRules, paymentMethodRules] = await Promise.all([
      loadParserRules("parser_keywords", "categories", "category", userId),
      loadParserRules("parser_payment_method_keywords", "payment_methods", "paymentMethod", userId)
    ]);

    return mergeParserLearning({ categories: categoryRules, paymentMethods: paymentMethodRules });
  } catch (error) {
    disableRemoteLearning(error);
    return null;
  }
}

async function loadParserRules(tableName, catalogRelation, valueKey, userId) {
  const { data, error } = await supabase
    .from(tableName)
    .select(`keyword, count, last_used_at, ${catalogRelation}(key)`)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("count", { ascending: false })
    .limit(50);

  if (error) {
    if (["42P01", "42703", "42501"].includes(error.code)) {
      return [];
    }
    disableRemoteLearning(error);
    return [];
  }

  return (data || [])
    .map((rule) => ({
      keyword: rule.keyword,
      [valueKey]: rule[catalogRelation]?.key,
      count: rule.count,
      lastUsedAt: rule.last_used_at
    }))
    .filter((rule) => rule.keyword && rule[valueKey]);
}

function disableRemoteLearning(error) {
  remoteLearningDisabled = true;
  if (process.env.NODE_ENV !== "production") {
    console.warn("Parser remoto desactivado: revisar esquema de parser_keywords.", error?.message || error);
  }
}

function buildExpenseMetadata(expense) {
  const metadata = normalizeMetadata(expense.metadata);
  const locationName = expense.location?.place?.name || metadata.location_name;

  if (locationName) {
    metadata.location_name = String(locationName);
  }

  return metadata;
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return { ...metadata };
}

export async function deleteRemoteExpense(id) {
  if (!isSupabaseConfigured) {
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) {
    return;
  }

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function migrateLocalExpenses(expenses) {
  if (!isSupabaseConfigured || expenses.length === 0) {
    return;
  }

  const existingIds = await loadExistingExpenseIds(expenses.map((expense) => expense.id));
  const pendingExpenses = expenses.filter((expense) => !existingIds.has(expense.id));

  await Promise.all(pendingExpenses.map((expense) => saveRemoteExpense(expense)));
}

async function loadExistingExpenseIds(ids) {
  const validIds = ids.filter(Boolean);
  if (validIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase.from("expenses").select("id").in("id", validIds);
  if (error) {
    throw error;
  }

  return new Set((data || []).map((expense) => expense.id));
}

async function ensureCatalogCache() {
  if (categoryByKey.size && paymentMethodByKey.size) {
    return;
  }

  const [
    { data: categories, error: categoriesError },
    { data: paymentMethods, error: paymentMethodsError }
  ] = await Promise.all([
    supabase.from("categories").select("id, key"),
    supabase.from("payment_methods").select("id, key")
  ]);

  if (categoriesError) {
    throw categoriesError;
  }

  if (paymentMethodsError) {
    throw paymentMethodsError;
  }

  categoryByKey.clear();
  paymentMethodByKey.clear();

  for (const category of categories || []) {
    categoryByKey.set(category.key, category.id);
  }

  for (const paymentMethod of paymentMethods || []) {
    paymentMethodByKey.set(paymentMethod.key, paymentMethod.id);
  }

  assertCatalog("categories", categoryByKey, expectedCategories);
  assertCatalog("payment_methods", paymentMethodByKey, expectedPaymentMethods);
}

function assertCatalog(tableName, valuesByKey, expectedKeys) {
  if (valuesByKey.size === 0) {
    throw new Error(`${tableName} no devolvio filas para el usuario autenticado.`);
  }

  const missingKeys = expectedKeys.filter((key) => !valuesByKey.has(key));
  if (missingKeys.length > 0) {
    throw new Error(`${tableName} no tiene keys requeridas: ${missingKeys.join(", ")}`);
  }
}
