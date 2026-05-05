import assert from "node:assert/strict";
import { applyLearnedParserRules, parseExpenseInput } from "../lib/expenseParser.js";

const cases = [
  {
    input: "4500 comida",
    expected: { amount: 4500, category: "food", paymentMethod: "cash" }
  },
  {
    input: "4500 fiambre",
    expected: { amount: 4500, category: "food", paymentMethod: "cash", description: "fiambre" }
  },
  {
    input: "3400 soda",
    expected: { amount: 3400, category: "food", paymentMethod: "cash", description: "soda" }
  },
  {
    input: "2500 turrones",
    expected: { amount: 2500, category: "food", paymentMethod: "cash", description: "turrones" }
  },
  {
    input: "2578 pack de internet",
    expected: { amount: 2578, category: "home", paymentMethod: "cash", description: "pack internet" }
  },
  {
    input: "21009 cargador notebook",
    expected: { amount: 21009, category: "other", paymentMethod: "cash", description: "cargador notebook" }
  },
  {
    input: "10000 comida",
    expected: { amount: 10000, category: "food", paymentMethod: "cash", description: "comida" }
  },
  {
    input: "uber 3200 mp",
    expected: { amount: 3200, category: "transport", paymentMethod: "transfer", description: "uber" }
  },
  {
    input: "1200 uber mp",
    expected: { amount: 1200, category: "transport", paymentMethod: "transfer", description: "uber" }
  },
  {
    input: "$4.500 cafe",
    expected: { amount: 4500, category: "food", paymentMethod: "cash" }
  },
  {
    input: "super 12000 debito",
    expected: { amount: 12000, category: "market", paymentMethod: "debit" }
  },
  {
    input: "nafta 8000 credito",
    expected: { amount: 8000, category: "transport", paymentMethod: "credit" }
  },
  {
    input: "8500 cine tarjeta 3 cuotas",
    expected: { amount: 8500, category: "leisure", paymentMethod: "credit", description: "cine", installments: 3 }
  },
  {
    input: "cine 3 cuotas 8500",
    expected: { amount: 8500, category: "leisure", paymentMethod: "credit", description: "cine", installments: 3 }
  },
  {
    input: "dpec 12000",
    expected: { amount: 12000, category: "home", paymentMethod: "cash" }
  },
  {
    input: "dentista 12000",
    expected: { amount: 12000, category: "health", paymentMethod: "cash" }
  },
  {
    input: "chipa 1800",
    expected: { amount: 1800, category: "food", paymentMethod: "cash" }
  },
  {
    input: "cine 2500",
    expected: { amount: 2500, category: "leisure", paymentMethod: "cash" }
  },
  {
    input: "cine 8000",
    expected: { amount: 8000, category: "leisure", paymentMethod: "cash" }
  },
  {
    input: "service 35000 transferencia",
    expected: { amount: 35000, category: "services", paymentMethod: "transfer" }
  },
  {
    input: "estacionamiento medido 900 mp",
    expected: { amount: 900, category: "transport", paymentMethod: "transfer" }
  },
  {
    input: "uber 2500 mp",
    expected: { amount: 2500, category: "transport", paymentMethod: "transfer" }
  },
  {
    input: "pague con tarjeta visa",
    expected: { amount: 0, category: "other", paymentMethod: "credit" }
  },
  {
    input: "pague con tarjeta por mercado pago",
    expected: { amount: 0, category: "other", paymentMethod: "credit" }
  },
  {
    input: "debito supermercado",
    expected: { amount: 0, category: "food", paymentMethod: "debit" }
  },
  {
    input: "débito supermercado",
    expected: { amount: 0, category: "food", paymentMethod: "debit" }
  },
  {
    input: "FIAMBRE",
    expected: { amount: 0, category: "food", paymentMethod: "cash" }
  },
  {
    input: "aguas 4500",
    expected: { amount: 4500, category: "home", paymentMethod: "cash" }
  }
];

for (const item of cases) {
  const result = parseExpenseInput(item.input);
  assert.equal(result.amount, item.expected.amount, `${item.input}: amount`);
  assert.equal(result.category, item.expected.category, `${item.input}: category`);
  assert.equal(result.paymentMethod, item.expected.paymentMethod, `${item.input}: paymentMethod`);
  if (item.expected.description) {
    assert.equal(result.description, item.expected.description, `${item.input}: description`);
  }
  if (item.expected.installments) {
    assert.equal(result.installments, item.expected.installments, `${item.input}: installments`);
    assert.equal(result.installmentNumber, 1, `${item.input}: installmentNumber`);
  }
}

applyLearnedParserRules({
  categories: [{ keyword: "viveres", category: "market", count: 3 }],
  paymentMethods: [{ keyword: "cuenta dni", paymentMethod: "transfer", count: 3 }]
});

const learnedCategory = parseExpenseInput("4500 viveres");
assert.equal(learnedCategory.category, "market", "learned category keyword");

const learnedPaymentMethod = parseExpenseInput("4500 viveres cuenta dni");
assert.equal(learnedPaymentMethod.paymentMethod, "transfer", "learned payment method keyword");

applyLearnedParserRules();

const correctedInstallments = parseExpenseInput("8500 cine tarjeta 3 cuotas", { installments: 1 });
assert.equal(correctedInstallments.installments, 1, "manual installment override");
assert.equal(correctedInstallments.installmentNumber, null, "manual installment override number");

console.log("Parser tests passed");
