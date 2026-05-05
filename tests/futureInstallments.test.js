import assert from "node:assert/strict";
import {
  buildFutureInstallmentSchedule,
  summarizeNextMonthInstallments
} from "../lib/futureInstallments.js";

const sixInstallments = buildFutureInstallmentSchedule(
  [
    {
      id: "expense-1",
      amount: 120000,
      paymentMethod: "credit",
      creditCardId: "card-1",
      installments: 6,
      installmentNumber: 1,
      statementMonth: "2026-05-01"
    }
  ],
  {
    monthsAhead: 6,
    referenceDate: new Date("2026-05-03T12:00:00.000Z")
  }
);

assert.deepEqual(
  sixInstallments.map((row) => [row.month, row.committedAmount]),
  [
    ["2026-05-01", 20000],
    ["2026-06-01", 20000],
    ["2026-07-01", 20000],
    ["2026-08-01", 20000],
    ["2026-09-01", 20000],
    ["2026-10-01", 20000]
  ]
);

const currentThirdInstallment = buildFutureInstallmentSchedule(
  [
    {
      id: "expense-2",
      amount: 120000,
      paymentMethod: "credit",
      creditCardId: "card-1",
      installments: 6,
      installmentNumber: 3,
      statementMonth: "2026-07-01"
    }
  ],
  {
    monthsAhead: 6,
    referenceDate: new Date("2026-07-03T12:00:00.000Z")
  }
);

assert.deepEqual(
  currentThirdInstallment.map((row) => [row.month, row.committedAmount]),
  [
    ["2026-07-01", 20000],
    ["2026-08-01", 20000],
    ["2026-09-01", 20000],
    ["2026-10-01", 20000]
  ]
);

const summary = summarizeNextMonthInstallments(
  sixInstallments,
  100000,
  [{ id: "card-1", name: "Visa prueba" }],
  new Date("2026-05-03T12:00:00.000Z")
);

assert.equal(summary.nextMonth, "2026-06-01");
assert.equal(summary.nextMonthInstallmentsTotal, 20000);
assert.equal(summary.installmentsCount, 1);
assert.equal(summary.incomeImpactPercentage, 20);
assert.equal(summary.status, "warning");
assert.deepEqual(summary.affectedCards, ["Visa prueba"]);

console.log("Future installments tests passed");
