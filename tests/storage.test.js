import assert from "node:assert/strict";
import { hasMigratedExpenses, isToday, markExpensesMigrated, normalizeExpenses } from "../lib/expensesStorage.js";

const normalized = normalizeExpenses([
  {
    id: "valid-older",
    amount: "1200",
    category: "unknown",
    paymentMethod: "unknown",
    description: "",
    createdAt: "2025-01-01T10:00:00.000Z"
  },
  {
    id: "valid-newer",
    amount: 4500,
    category: "food",
    paymentMethod: "cash",
    description: "comida",
    rawText: "4500 comida",
    createdAt: "2025-01-02T10:00:00.000Z"
  },
  { amount: 0 },
  null,
  "bad"
]);

assert.equal(normalized.length, 2);
assert.equal(normalized[0].id, "valid-newer");
assert.equal(normalized[1].category, "other");
assert.equal(normalized[1].paymentMethod, "cash");
assert.equal(normalized[1].description, "Gasto rapido");
assert.equal(isToday("not-a-date"), false);

const localStorageMock = new Map();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem(key) {
        return localStorageMock.get(key) ?? null;
      },
      setItem(key, value) {
        localStorageMock.set(key, String(value));
      }
    }
  }
});

assert.equal(hasMigratedExpenses("user-1"), false);
markExpensesMigrated("user-1");
assert.equal(hasMigratedExpenses("user-1"), true);
assert.equal(hasMigratedExpenses("user-2"), false);
assert.equal(hasMigratedExpenses(""), false);

console.log("Storage tests passed");
