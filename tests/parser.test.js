import assert from "node:assert/strict";
import { parseExpenseInput } from "../lib/expenseParser.js";

const cases = [
  {
    input: "4500 comida",
    expected: { amount: 4500, category: "food", paymentMethod: "cash" }
  },
  {
    input: "4500 fiambre",
    expected: { amount: 4500, category: "food", paymentMethod: "cash" }
  },
  {
    input: "uber 3200 mp",
    expected: { amount: 3200, category: "transport", paymentMethod: "transfer" }
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
}

console.log("Parser tests passed");
