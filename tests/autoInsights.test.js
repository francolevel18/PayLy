import assert from "node:assert/strict";
import { formatAutoInsight, normalizeAutoInsights } from "../lib/autoInsights.js";

const normalized = normalizeAutoInsights([
  {
    type: "budget_pace",
    severity: "warning",
    title: "Ritmo del mes",
    message: "Venis gastando mas rapido que lo esperado."
  },
  {
    type: "unknown",
    severity: "urgent",
    title: "Dato raro",
    message: "Este insight igual se puede mostrar."
  },
  {
    type: "top_category",
    severity: "info",
    title: "Sin mensaje"
  }
]);

assert.equal(normalized.length, 2);
assert.equal(normalized[0].type, "budget_pace");
assert.equal(normalized[0].severity, "warning");
assert.equal(normalized[1].type, "top_category");
assert.equal(normalized[1].severity, "info");

assert.equal(
  formatAutoInsight(normalized[0]),
  "Ritmo del mes: Venis gastando mas rapido que lo esperado."
);

assert.equal(
  formatAutoInsight({
    title: "Ritmo del mes",
    message: "Ritmo del mes: venis dentro del margen."
  }),
  "Ritmo del mes: venis dentro del margen."
);

assert.deepEqual(normalizeAutoInsights(null), []);
assert.equal(formatAutoInsight({}), "");

console.log("Auto insights tests passed");
