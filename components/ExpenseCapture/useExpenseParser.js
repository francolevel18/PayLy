import { useMemo } from "react";

export const categories = ["services", "food", "health", "home", "market", "other", "leisure", "transport"];
export const paymentMethods = ["cash", "debit", "credit", "transfer"];
const paymentMethodPriority = ["credit", "debit", "transfer", "cash"];
const ignoredLearningWords = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "con",
  "en",
  "por",
  "para",
  "pague",
  "pago",
  "gasto",
  "gastos",
  "compra",
  "compras"
]);
const learnedCategoryKeywords = {};
const learnedPaymentMethodKeywords = {};

const categoryKeywords = {
  food: [
    "comida",
    "almuerzo",
    "cena",
    "desayuno",
    "cafe",
    "medialunas",
    "pizza",
    "empanada",
    "empanadas",
    "lomito",
    "helado",
    "birra",
    "vino",
    "gaseosa",
    "agua mineral",
    "yerba",
    "azucar",
    "soda",
    "fideos",
    "arroz",
    "pollo",
    "pescado",
    "fiambre",
    "turron",
    "turrones",
    "supermercado",
    "delivery",
    "rapi",
    "pedido",
    "pedidosya",
    "impulso",
    "parada canga",
    "supermax",
    "previsora",
    "chipa",
    "mbeyu",
    "charque",
    "asado",
    "vacio",
    "chorizo",
    "facturas",
    "bizcochos",
    "terere",
    "jugo",
    "fernet",
    "coca",
    "brahma",
    "quilmes",
    "artesanal"
  ],
  transport: [
    "uber",
    "taxi",
    "colectivo",
    "bondi",
    "sube",
    "subte",
    "tren",
    "moto",
    "nafta",
    "ypf",
    "shell",
    "axion",
    "combustible",
    "transporte",
    "estacionamiento medido",
    "estacionamiento",
    "peaje",
    "cochera",
    "remis",
    "aeropuerto",
    "didi",
    "garage",
    "aceite",
    "cubierta",
    "pinchazo",
    "gomeria",
    "lavadero",
    "vtv",
    "tarjetero",
    "chaco corrientes",
    "pasaje",
    "puente",
    "casco",
    "cadena"
  ],
  market: [
    "super",
    "mercado",
    "verduleria",
    "carniceria",
    "panaderia",
    "dietetica",
    "kiosco",
    "almacen",
    "despensa",
    "fiambreria",
    "chino",
    "mayorista",
    "carrefour",
    "coto",
    "dia",
    "changomas",
    "feria",
    "barrio",
    "autoservicio",
    "golosinas",
    "pucho"
  ],
  health: [
    "medico",
    "salud",
    "remedio",
    "farmacia",
    "consulta",
    "dentista",
    "oculista",
    "analisis",
    "radiografia",
    "crema",
    "anteojos"
  ],
  home: [
    "alquiler",
    "luz",
    "gas",
    "internet",
    "agua",
    "aguas",
    "casa",
    "celular",
    "expensas",
    "cable",
    "netflix",
    "spotify",
    "seguro",
    "monotributo",
    "municipal",
    "dgr",
    "dpec",
    "aguas de corrientes",
    "invico",
    "telco",
    "gigared",
    "claro",
    "personal",
    "movistar",
    "patente",
    "inmobiliario",
    "acat",
    "tasas",
    "plomero",
    "electricista",
    "albanil",
    "flete",
    "limpieza",
    "ferreteria",
    "pintura",
    "foco",
    "lavandina",
    "detergente"
  ],
  services: [
    "servicio",
    "servicios",
    "service",
    "mecanico",
    "taller",
    "peluqueria",
    "barberia",
    "reparacion",
    "arreglo",
    "mantenimiento",
    "contador",
    "abogado",
    "gestor",
    "mensajeria",
    "cadete"
  ],
  leisure: [
    "shopping",
    "costanera",
    "cine",
    "entradas",
    "recital",
    "bar",
    "joda",
    "boliche",
    "cancha",
    "pileta",
    "gimnasio",
    "pesca",
    "club",
    "viaje",
    "hotel",
    "vacaciones"
  ],
  other: [
    "zapas",
    "remera",
    "jean",
    "buzo",
    "unforme",
    "uniforme",
    "tienda",
    "regalo",
    "perfume"
  ]
};

const methodKeywords = {
  cash: ["efectivo", "cash"],
  debit: ["debito", "debit", "uala"],
  credit: ["credito", "tarjeta", "visa", "mastercard", "amex", "cuota", "cuotas"],
  transfer: ["transferencia", "transfer", "mp", "mercadopago", "mercado pago"]
};

const priorityCategoryKeywords = {
  food: ["chipa", "mbeyu", "soda", "turron", "turrones", "supermax", "impulso", "previsora"],
  transport: ["bondi", "sube", "remis", "estacionamiento medido", "tarjetero"],
  home: ["dpec", "aguas", "aguas de corrientes"],
  services: ["service", "taller", "mecanico"],
  leisure: ["cine", "recital", "boliche", "gimnasio"]
};

const labels = {
  categories: {
    food: "Comida",
    health: "Salud",
    home: "Casa",
    leisure: "Ocio",
    market: "Mercado",
    other: "Otro",
    services: "Servicios",
    transport: "Transporte"
  },
  paymentMethods: {
    cash: "Efectivo",
    debit: "Debito",
    credit: "Credito",
    transfer: "Transferencia"
  }
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}.,$]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeyword(keyword) {
  return typeof keyword === "string" ? normalizeText(keyword) : normalizeText(keyword?.keyword);
}

function getKeywordWeight(keyword) {
  return typeof keyword === "string" ? 1 : Number(keyword?.weight) || 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(text, keyword) {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return false;
  }

  return new RegExp(`(^|\\s)${escapeRegExp(normalizedKeyword)}(?=\\s|$)`).test(text);
}

function scoreKeywords(text, keywordMap) {
  return Object.entries(keywordMap).map(([key, words]) => ({
    key,
    score: words.reduce((total, word) => (hasKeyword(text, word) ? total + getKeywordWeight(word) : total), 0)
  }));
}

function findCategoryByScore(text, fallback) {
  const learnedWinner = findLearnedWinner(text, learnedCategoryKeywords);
  if (learnedWinner) {
    return learnedWinner;
  }

  const scores = scoreKeywords(text, mergeKeywordMaps(categoryKeywords, priorityCategoryKeywords));
  const winner = scores.reduce((best, current) => (current.score > best.score ? current : best), { key: fallback, score: 0 });
  return winner.score > 0 ? winner.key : fallback;
}

function findPaymentMethodByScore(text, fallback) {
  const learnedWinner = findLearnedWinner(text, learnedPaymentMethodKeywords);
  if (learnedWinner) {
    return learnedWinner;
  }

  const scoresByKey = new Map(scoreKeywords(text, methodKeywords).map((item) => [item.key, item.score]));
  return paymentMethodPriority.find((method) => (scoresByKey.get(method) || 0) > 0) || fallback;
}

function findLearnedWinner(text, keywordMap) {
  const scores = scoreKeywords(text, keywordMap);
  const winner = scores.reduce((best, current) => (current.score > best.score ? current : best), { key: "", score: 0 });
  return winner.score > 0 ? winner.key : "";
}

function mergeKeywordMaps(...maps) {
  return maps.reduce((result, map) => {
    for (const [key, words] of Object.entries(map)) {
      result[key] = [...(result[key] || []), ...words];
    }
    return result;
  }, {});
}

function parseAmount(rawAmount) {
  if (!rawAmount) {
    return 0;
  }

  const cleanAmount = rawAmount.replace(/[^\d.,]/g, "");
  const hasComma = cleanAmount.includes(",");
  const hasDot = cleanAmount.includes(".");

  if (hasComma && hasDot) {
    const decimalSeparator = cleanAmount.lastIndexOf(",") > cleanAmount.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(cleanAmount.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (hasDot) {
    const parts = cleanAmount.split(".");
    const lastPart = parts.at(-1);
    const isThousandsFormat = lastPart.length === 3 && parts.slice(0, -1).every(Boolean);
    return Number(isThousandsFormat ? parts.join("") : cleanAmount);
  }

  if (hasComma) {
    const parts = cleanAmount.split(",");
    const lastPart = parts.at(-1);
    const isThousandsFormat = lastPart.length === 3 && parts.slice(0, -1).every(Boolean);
    return Number(isThousandsFormat ? parts.join("") : cleanAmount.replace(",", "."));
  }

  return Number(cleanAmount);
}

function findAmountMatch(text) {
  const amountPattern = /\$?\s*\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;
  const matches = [...text.matchAll(amountPattern)];
  return matches.find((match) => {
    const afterMatch = text.slice((match.index || 0) + match[0].length).trimStart();
    return !/^(?:cuota|cuotas|x)\b/.test(afterMatch);
  });
}

function parseInstallments(text) {
  const normalizedText = normalizeText(text);
  const explicitMatch =
    normalizedText.match(/(?:en\s*)?(\d{1,2})\s*(?:cuota|cuotas|x)\b/) ||
    normalizedText.match(/\b(?:cuota|cuotas)\s*(\d{1,2})\b/);
  const installments = Number(explicitMatch?.[1]) || 1;
  return Math.max(1, Math.min(24, installments));
}

function removeKnownWords(text, keywordMap) {
  return Object.values(keywordMap)
    .flat()
    .reduce((current, word) => {
      const keyword = normalizeKeyword(word);
      return keyword ? current.replace(new RegExp(`(^|\\s)${escapeRegExp(keyword)}(?=\\s|$)`, "g"), " ") : current;
    }, text);
}

function removeIgnoredWords(text) {
  return text
    .split(" ")
    .filter((word) => !ignoredLearningWords.has(word))
    .join(" ");
}

export function parseExpenseInput(input, overrides = {}) {
  const text = normalizeText(input);
  const amountMatch = findAmountMatch(text);
  const amount = parseAmount(amountMatch?.[0]);
  const parsedInstallments = parseInstallments(text);

  const paymentMethod =
    overrides.paymentMethod ??
    (parsedInstallments > 1 ? "credit" : findPaymentMethodByScore(text, "cash"));
  const categoryText = removeKnownWords(text, methodKeywords).replace(/\s+/g, " ").trim();
  const category =
    overrides.category ??
    findCategoryByScore(categoryText, "other");
  const installments = paymentMethod === "credit" ? Math.max(1, Number(overrides.installments) || parsedInstallments) : 1;

  const description = removeIgnoredWords(removeKnownWords(
    text
      .replace(amountMatch?.[0] ?? "", "")
      .replace(/(?:en\s*)?\d{1,2}\s*(?:cuota|cuotas|x)\b/g, "")
      .replace(/\b(?:cuota|cuotas)\s*\d{1,2}\b/g, ""),
    methodKeywords
  ))
    .replace(/\s+/g, " ")
    .trim();

  return {
    amount,
    category,
    paymentMethod,
    installments,
    installmentNumber: installments > 1 ? 1 : null,
    description: description || "Gasto rapido"
  };
}

export function getLearningKeyword(input) {
  const text = normalizeText(input);
  const amountMatch = findAmountMatch(text);
  const withoutAmount = text.replace(amountMatch?.[0] ?? "", " ").replace(/\s+/g, " ").trim();
  const cleanText = removeKnownWords(withoutAmount, methodKeywords).replace(/\s+/g, " ").trim();
  const words = cleanText
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !ignoredLearningWords.has(word));

  if (words.length === 0) {
    return "";
  }

  return words.slice(0, 2).join(" ");
}

export function applyLearnedParserRules({ categories: categoryRules = [], paymentMethods: paymentMethodRules = [] } = {}) {
  replaceKeywordMap(learnedCategoryKeywords, categoryRules, categories);
  replaceKeywordMap(learnedPaymentMethodKeywords, paymentMethodRules, paymentMethods);
}

export function addLearnedParserRule(type, keyword, value, count = 1) {
  const normalizedKeyword = normalizeKeyword(keyword);
  const targetMap = type === "paymentMethod" ? learnedPaymentMethodKeywords : learnedCategoryKeywords;
  const allowedValues = type === "paymentMethod" ? paymentMethods : categories;

  if (!normalizedKeyword || !allowedValues.includes(value)) {
    return;
  }

  targetMap[value] = [
    ...(targetMap[value] || []).filter((item) => normalizeKeyword(item) !== normalizedKeyword),
    { keyword: normalizedKeyword, weight: getLearningWeight(count) }
  ];
}

function replaceKeywordMap(targetMap, rules, allowedValues) {
  for (const key of Object.keys(targetMap)) {
    delete targetMap[key];
  }

  for (const rule of rules) {
    const value = rule.category || rule.paymentMethod;
    if (!allowedValues.includes(value)) {
      continue;
    }

    addRuleToMap(targetMap, value, rule.keyword, rule.count);
  }
}

function addRuleToMap(targetMap, value, keyword, count = 1) {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return;
  }

  targetMap[value] = [...(targetMap[value] || []), { keyword: normalizedKeyword, weight: getLearningWeight(count) }];
}

function getLearningWeight(count) {
  const safeCount = Number(count) || 1;
  if (safeCount < 2) {
    return 0;
  }

  return Math.max(6, Math.min(20, safeCount));
}

export function useExpenseParser(input, overrides = {}) {
  return useMemo(
    () => parseExpenseInput(input, overrides),
    [input, overrides.category, overrides.installments, overrides.paymentMethod]
  );
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export function getCategoryLabel(category) {
  return labels.categories[category] ?? labels.categories.other;
}

export function getPaymentMethodLabel(paymentMethod) {
  return labels.paymentMethods[paymentMethod] ?? labels.paymentMethods.cash;
}
