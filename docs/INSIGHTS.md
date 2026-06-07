# Modulos de Logica

## Radar Financiero

**Archivo**: `lib/financialRadar.js`

Funcion: `calculateFinancialRadar(expenses, budgets, paymentMethods)`

Calcula el estado financiero del usuario basado en gasto vs presupuesto.

### Estados

| Estado | Condicion | Color |
|--------|-----------|-------|
| `normal` | Gasto < 50% del presupuesto | Verde |
| `warning` | Gasto entre 50% y 80% | Amarillo |
| `critical` | Gasto > 80% | Rojo |
| `unknown` | Sin presupuesto o sin gastos | Gris |

### Algoritmo

```
Por cada categoria con presupuesto:
  gastado = suma de gastos en esa categoria
  ratio = gastado / presupuesto
  
  Si ratio >= 0.8 -> critical
  Si ratio >= 0.5 -> warning
  Sino -> normal

Estado global = el peor estado entre todas las categorias
```

### Cuotas futuras en radar

Si hay cuotas futuras significativas (compras con installments > installment_number), se agregan como gasto futuro:

```js
// Si las cuotas futuras > 30% del presupuesto total
// el estado puede escalar de normal a warning
```

## Cuotas Futuras

**Archivo**: `lib/futureInstallments.js`

Funcion: `buildFutureInstallmentSchedule(expenses, monthsAhead = 6)`

### Logica

Toma todos los gastos que tienen `installment_number < installments` y calcula cuanto falta pagar en cada mes.

```js
for (const expense of expenses) {
  if (expense.installments && expense.installments > 1) {
    const installmentAmount = expense.amount / expense.installments;
    const remainingInstallments = expense.installments - (expense.installment_number || 1);
    
    for (let i = 1; i <= remainingInstallments; i++) {
      const monthStart = startOfMonth(addMonths(
        expense.statement_month || expense.spent_at, i
      ));
      schedule[monthStart] = (schedule[monthStart] || 0) + installmentAmount;
    }
  }
}
```

### Budget Awareness

Si se provee un presupuesto mensual, calcula cuantos meses se pueden sostener las cuotas futuras:

```js
let monthsBeforeExhaustion = -1; // significa que alcanza
if (budget) {
  const totalFuturePerMonth = ...;
  if (totalFuturePerMonth > budget) {
    monthsBeforeExhaustion = Math.floor(budget / totalFuturePerMonth);
  }
}
```

### Fallback RPC

Si hay sesion en Supabase, intenta `get_future_installments(p_months_ahead)`. Si falla, usa el calculo local.

## Auto Insights

**Archivo**: `lib/autoInsights.js`

Funcion: `assessInsights(expenses, budgets, categories, paymentMethods)`

### Tipos de insights

| Tipo | Condicion | Severidad |
|------|-----------|-----------|
| `top_category` | Categoria con mas gasto | info |
| `overspend` | Se excedio el presupuesto en 1 categoria | warning |
| `multiple_overspend` | Se excedio en varias categorias | critical |
| `budget_at_limit` | Gasto exactamente al limite | warning |
| `credit_dominant` | >60% en tarjeta de credito | warning |
| `cash_dominant` | >60% en efectivo | info |
| `no_insights` | Sin datos | info |

### Fallback RPC

Si hay sesion en Supabase, intenta `get_auto_insights()`. Si falla, usa el calculo local via `normalizeAutoInsights()`.

## Presupuestos

**Archivo**: `lib/budgetsRepository.js`

Funciones:

| Funcion | Descripcion |
|---------|-------------|
| `loadLocalBudgets()` | Carga presupuestos de localStorage |
| `saveLocalBudgets(budgets)` | Guarda en localStorage |
| `loadRemoteBudgets()` | Carga de Supabase |
| `saveRemoteBudget(budget)` | Guarda en Supabase |
| `mergeBudgets(local, remote)` | Combina (locales ganan conflicto) |
| `getBudgetForCategory(categoryKey)` | Obtiene presupuesto de una categoria |

## Tarjetas de Credito

**Archivo**: `lib/cardsRepository.js`

Funciones:

| Funcion | Descripcion |
|---------|-------------|
| `loadLocalCreditCards()` | Carga de localStorage |
| `saveLocalCreditCards(cards)` | Guarda en localStorage |
| `loadRemoteCreditCards()` | Carga de Supabase |
| `saveRemoteCreditCard(card)` | Guarda en Supabase |
| `getCardBalance(card, expenses)` | Calcula saldo actual |
| `getCardsWithBalances(cards, expenses)` | Todas con saldos calculados |

### Calculo de saldo

```js
function getCardBalance(card, expenses) {
  const cardExpenses = expenses.filter(e => e.credit_card_id === card.id);
  const total = cardExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  return {
    used: total,
    limit: card.credit_limit,
    available: card.credit_limit - total,
    usagePercent: (total / card.credit_limit) * 100
  };
}
```

## Auth

**Archivo**: `hooks/useAuth.js`

Hook de autenticacion con Supabase Auth.

Estado:

| Propiedad | Tipo | Descripcion |
|-----------|------|-------------|
| `user` | Object / null | Usuario autenticado o null |
| `session` | Object / null | Sesion de Supabase |
| `signInWithGoogle` | Function | Login con Google OAuth |
| `signOut` | Function | Logout |
| `loading` | boolean | Estado de carga |

```js
const { user, session, signInWithGoogle, signOut, loading } = useAuth();
```

## Configuracion de Recordatorios

**Archivo**: `components/Settings/ReminderSettings.jsx`

Configuracion de notificaciones push:

- Modo: daily
- Horario: 21:00 (por defecto)
- Zona horaria: America/Argentina/Buenos_Aires (por defecto)
- Tono: tranqui, picante, corto

### Push Subscriptions

**Archivo**: `lib/pushSubscriptionsRepository.js`

Funciones:

| Funcion | Descripcion |
|---------|-------------|
| `saveSubscription(subscription)` | Guarda en Supabase |
| `loadSubscription()` | Carga del usuario |
| `removeSubscription(endpoint)` | Elimina suscripcion |
