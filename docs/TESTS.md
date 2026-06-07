# Tests

Framework: Node.js nativo (`node:test`, `node:assert`). Sin jest, sin vitest.

## Ejecucion

```bash
npm test              # Todos los tests
npm run test:parser   # Tests del parser
npm run test:storage  # Tests de storage local
npm run test:timeline # Tests de agrupacion temporal
npm run test:installments # Tests de cuotas futuras
npm run test:radar    # Tests de radar financiero
npm run test:insights # Tests de auto insights
```

Los comandos se definen en `package.json` (scripts).

## Archivos

```
tests/
├── parser.test.js
├── storage.test.js
├── timeline.test.js
├── installments.test.js
├── radar.test.js
├── insights.test.js
├── test-helper.js
└── mock-data/
```

## Mock de Supabase

**Archivo**: `tests/test-helper.js`

Función `mockSupabase()` para tests que dependen de Supabase (actualmente sin uso directo, pero disponible).

## Tests por modulo

### Parser (`tests/parser.test.js`)

~150 lineas, 29+ casos. Prueba `parseExpenseInput()` pura.

Categorias probadas:
- Parseo basico
- Categorias explicitas e implicitas
- Formatos de moneda (con "$", con ".", sin simbolo)
- Metodos de pago explicitos
- Cuotas ("en 3 cuotas", "en 6 pagos", "3x")
- Montos coloquiales ("lucas", "k", "mil")
- Aprendizaje de reglas (keyword -> categoria)
- Aprendizaje de metodo de pago

### Storage (`tests/storage.test.js`)

Prueba operaciones CRUD de localStorage.

Casos:
- `saveLocalExpense` y `loadLocalExpenses` (basic write/read)
- `removeLocalExpense`
- `updateLocalExpense` (partial update)
- `clearLocalExpenses`
- IDs unicos en cada save
- Persistencia entre saves
- Multiple expenses

**Setup**: `beforeEach` -> `clearLocalExpenses()` + localStorage mock.

### Timeline (`tests/timeline.test.js`)

Prueba `groupExpensesByTimeframe()`.

Casos:
- Agrupa gastos de hoy en "last_24h"
- Agrupa gastos de esta semana (sin hoy) en "earlier_this_week"
- Agrupa gastos de la semana pasada en "last_week"
- Agrupa gastos del mismo mes (sin semanas) en "this_month"
- Agrupa gastos de meses anteriores en "older"
- Empty array
- Maneja fechas ISO

### Cuotas Futuras (`tests/installments.test.js`)

Prueba `buildFutureInstallmentSchedule()`.

Casos:
- Compra simple sin cuotas
- Compra en 3 cuotas con installment_number=1
- Compra en 6 cuotas (paso a paso)
- Multiple compras con cuotas en distintos meses
- Sin gastos -> schedule vacio
- Instalment medio (installment_number=2 de 3)
- Presupuesto y cuotas combinados (budget awareness)

### Radar Financiero (`tests/radar.test.js`)

Prueba `calculateFinancialRadar()`.

Casos:
- Estado NORMAL: gasto < 50% del presupuesto
- Estado WARNING: gasto entre 50% y 80%
- Estado CRITICAL: gasto > 80%
- Sin presupuesto -> unknown
- Sin gastos -> unknown
- Con cuotas futuras que empujan de normal a warning
- Sin budget -> no afecta cuotas
- Presupuesto en 0 -> no division by zero, retorna unknown

### Auto Insights (`tests/insights.test.js`)

Prueba `assessInsights()`.

Casos:
- Gasto en una categoria > presupuesto -> overspend
- Gasto en varias categorias > presupuesto -> multiple_overspend
- Sin presupuesto -> no_insights
- Sin gastos -> no_insights
- Tarjeta de credito dominante -> credit_dominant
- Sin gastos en credito -> no credit_dominant
- Categoria con mas gasto -> top_category
- Budget con gasto exacto en el limite -> budget_at_limit
- Sin budget -> no budget_at_limit
- Gasto en efectivo -> cash_dominant

## Agregar un test nuevo

```js
// tests/foo.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Mi modulo', () => {
  it('deberia hacer algo', () => {
    const result = miFuncion('input');
    assert.strictEqual(result, 'esperado');
  });
});
```

## Mock de localStorage en tests

```js
// Al inicio del archivo de test
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};
```
