import { addLearnedParserRule, applyLearnedParserRules, getLearningKeyword } from "./expenseParser";

const learningKey = "payly.parserLearning";

export function loadLocalParserLearning() {
  if (typeof window === "undefined") {
    return { categories: [], paymentMethods: [] };
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(learningKey)) || {};
    return normalizeLearning(stored);
  } catch {
    return { categories: [], paymentMethods: [] };
  }
}

export function applyLocalParserLearning() {
  const learning = loadLocalParserLearning();
  applyLearnedParserRules(learning);
  return learning;
}

export function mergeParserLearning(remoteLearning) {
  const localLearning = loadLocalParserLearning();
  const merged = {
    categories: mergeRules(localLearning.categories, remoteLearning?.categories || [], "category"),
    paymentMethods: mergeRules(localLearning.paymentMethods, remoteLearning?.paymentMethods || [], "paymentMethod")
  };

  saveLocalParserLearning(merged);
  applyLearnedParserRules(merged);
  return merged;
}

export function rememberParserCorrection(rawText, detectedExpense, correctedExpense) {
  const keyword = getLearningKeyword(rawText);
  if (!keyword) {
    return null;
  }

  const learning = loadLocalParserLearning();
  const saved = { keyword };

  if (correctedExpense.category && correctedExpense.category !== detectedExpense.category) {
    upsertRule(learning.categories, {
      keyword,
      category: correctedExpense.category,
      count: 1,
      lastUsedAt: new Date().toISOString()
    });
    addLearnedParserRule("category", keyword, correctedExpense.category, 1);
    saved.category = correctedExpense.category;
  }

  if (correctedExpense.paymentMethod && correctedExpense.paymentMethod !== detectedExpense.paymentMethod) {
    upsertRule(learning.paymentMethods, {
      keyword,
      paymentMethod: correctedExpense.paymentMethod,
      count: 1,
      lastUsedAt: new Date().toISOString()
    });
    addLearnedParserRule("paymentMethod", keyword, correctedExpense.paymentMethod, 1);
    saved.paymentMethod = correctedExpense.paymentMethod;
  }

  if (!saved.category && !saved.paymentMethod) {
    return null;
  }

  saveLocalParserLearning(learning);
  return saved;
}

function normalizeLearning(learning) {
  return {
    categories: normalizeRules(learning.categories, "category"),
    paymentMethods: normalizeRules(learning.paymentMethods, "paymentMethod")
  };
}

function normalizeRules(rules, valueKey) {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .map((rule) => ({
      keyword: typeof rule.keyword === "string" ? rule.keyword : "",
      [valueKey]: typeof rule[valueKey] === "string" ? rule[valueKey] : "",
      count: Math.max(1, Number(rule.count) || 1),
      lastUsedAt: typeof rule.lastUsedAt === "string" ? rule.lastUsedAt : ""
    }))
    .filter((rule) => rule.keyword && rule[valueKey]);
}

function mergeRules(localRules, remoteRules, valueKey) {
  const byKey = new Map();
  for (const rule of [...localRules, ...normalizeRules(remoteRules, valueKey)]) {
    const key = `${rule.keyword}:${rule[valueKey]}`;
    const current = byKey.get(key);
    byKey.set(key, {
      ...rule,
      count: Math.max(current?.count || 0, Number(rule.count) || 1),
      lastUsedAt: rule.lastUsedAt || current?.lastUsedAt || ""
    });
  }

  return [...byKey.values()];
}

function upsertRule(rules, nextRule) {
  const existing = rules.find(
    (rule) =>
      rule.keyword === nextRule.keyword &&
      (rule.category === nextRule.category || rule.paymentMethod === nextRule.paymentMethod)
  );

  if (existing) {
    existing.count = (Number(existing.count) || 1) + 1;
    existing.lastUsedAt = nextRule.lastUsedAt;
    return;
  }

  rules.push(nextRule);
}

function saveLocalParserLearning(learning) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(learningKey, JSON.stringify(normalizeLearning(learning)));
  } catch {
    // localStorage can fail in private mode or when quota is full.
  }
}
