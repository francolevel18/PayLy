import { normalizeExpenses } from "./expensesStorage";
import {
  categories as expectedCategories,
  getLearningKeyword,
  parseExpenseInput,
  paymentMethods as expectedPaymentMethods
} from "./expenseParser";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const categoryByKey = new Map();
const paymentMethodByKey = new Map();

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
    .select("id, amount, description, raw_text, spent_at, created_at, categories(key), payment_methods(key)")
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
      createdAt: expense.spent_at || expense.created_at
    }))
  );
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
    source: "parser"
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

export async function learnFromExpenseCorrection(rawText, correctedExpense) {
  if (!isSupabaseConfigured || !rawText) {
    return;
  }

  const keyword = getLearningKeyword(rawText);
  if (!keyword) {
    return;
  }

  const detectedExpense = parseExpenseInput(rawText);
  const learningTasks = [];

  if (correctedExpense.category && correctedExpense.category !== detectedExpense.category) {
    learningTasks.push(saveParserKeyword("parser_keywords", { keyword, category: correctedExpense.category }, "keyword,category"));
  }

  if (correctedExpense.paymentMethod && correctedExpense.paymentMethod !== detectedExpense.paymentMethod) {
    learningTasks.push(
      saveParserKeyword(
        "parser_payment_method_keywords",
        { keyword, payment_method: correctedExpense.paymentMethod },
        "keyword,payment_method"
      )
    );
  }

  await Promise.all(learningTasks);
}

async function saveParserKeyword(tableName, payload, onConflict) {
  const { error } = await supabase.from(tableName).upsert(payload, {
    ignoreDuplicates: true,
    onConflict
  });

  if (error && !["42P01", "42501"].includes(error.code)) {
    throw error;
  }
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
