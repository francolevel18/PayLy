import assert from "node:assert/strict";
import { computeFinancialRadarState } from "../lib/financialRadar.js";

const normal = computeFinancialRadarState({
  currentSpent: 30000,
  monthlyBudget: 120000,
  monthlyIncome: 200000,
  nextMonthInstallments: 10000,
  projectedTotal: 90000
});

assert.equal(normal.status, "normal");
assert.equal(normal.referenceKind, "budget");
assert.equal(normal.label, "Vas bien");

const incomeFallback = computeFinancialRadarState({
  currentSpent: 60000,
  monthlyBudget: 0,
  monthlyIncome: 200000,
  nextMonthInstallments: 0,
  projectedTotal: 120000
});

assert.equal(incomeFallback.status, "normal");
assert.equal(incomeFallback.referenceKind, "income");
assert.equal(incomeFallback.referenceAmount, 200000);

const warning = computeFinancialRadarState({
  currentSpent: 90000,
  monthlyBudget: 120000,
  monthlyIncome: 200000,
  nextMonthInstallments: 10000,
  projectedTotal: 105000
});

assert.equal(warning.status, "warning");
assert.equal(warning.label, "Atencion");

const criticalByProjection = computeFinancialRadarState({
  currentSpent: 110000,
  monthlyBudget: 120000,
  monthlyIncome: 200000,
  nextMonthInstallments: 0,
  projectedTotal: 140000
});

assert.equal(criticalByProjection.status, "critical");
assert.equal(criticalByProjection.label, "Alto riesgo");

const criticalByCommitment = computeFinancialRadarState({
  currentSpent: 50000,
  monthlyBudget: 0,
  monthlyIncome: 200000,
  nextMonthInstallments: 70000,
  projectedTotal: 90000
});

assert.equal(criticalByCommitment.status, "critical");
assert.equal(criticalByCommitment.referenceKind, "income");

const noReference = computeFinancialRadarState({
  currentSpent: 50000,
  projectedTotal: 100000
});

assert.equal(noReference.status, "normal");
assert.equal(noReference.referenceKind, "none");

console.log("Financial radar tests passed");
