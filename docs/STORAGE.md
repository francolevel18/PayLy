# Storage y Sincronizacion

## Capas de almacenamiento

### 1. localStorage (siempre disponible)

**Archivo**: `lib/expensesStorage.js`

Funciones:

| Funcion | Proposito |
|---------|-----------|
| `saveLocalExpense(expense)` | Guarda un gasto en localStorage |
| `loadLocalExpenses()` | Carga todos los gastos |
| `removeLocalExpense(id)` | Elimina un gasto |
| `updateLocalExpense(id, updates)` | Actualiza parcialmente |
| `clearLocalExpenses()` | Limpia todo |

### 2. Supabase (cuando hay sesion)

**Archivo**: `lib/expensesRepository.js`

Funciones:

| Funcion | Proposito |
|---------|-----------|
| `saveRemoteExpense(expense)` | Crea gasto en Supabase |
| `loadRemoteExpenses()` | Carga gastos del usuario |
| `updateRemoteExpense(id, updates)` | Actualiza en Supabase |
| `removeRemoteExpense(id)` | Elimina en Supabase |
| `saveRemoteParserLearning(category, paymentMethod, keyword)` | Aprende keyword |
| `loadRemoteParserLearning()` | Carga keywords aprendidas |
| `loadRemoteCategories()` | Carga todas las categorias |
| `loadRemotePaymentMethods()` | Carga todos los metodos de pago |
| `loadRemoteBudgets()` | Carga presupuestos |
| `saveRemoteBudget()` | Guarda presupuesto |
| `loadRemoteSettings()` | Carga preferencias |
| `saveRemoteSettings()` | Guarda preferencias |
| `loadRemoteCreditCards()` | Carga tarjetas de credito |
| `loadRemoteDebtors()` | Carga deudores |
| `loadRemoteDebts()` | Carga deudas |

### 3. Catalog Cache (en memoria)

```js
// lib/expensesRepository.js
const categoryByKey = new Map();
const paymentMethodByKey = new Map();
```

Se cargan una vez desde Supabase y se mantienen en memoria durante la sesion.

## Sincronizacion

### Flujo de guardado

```
addExpense(expense)
    |
    v
saveLocalExpense(expense)     -> Siempre, inmediato
    |
    +-> Si hay sesion:
          updateSyncState(id, 'pending')
          saveRemoteExpense(expense)
            -> Exito: updateSyncState(id, 'synced')
            -> Fallo: updateSyncState(id, 'error')
```

### Flujo de migracion

```
migrateLocalExpenses()
    |
    v
loadLocalExpenses()
    |
    v
Filtrar: syncState === 'local' || syncState === 'pending'
    |
    v
Para cada uno:
    saveRemoteExpense()
      -> Exito: updateSyncState(id, 'synced')
      -> Fallo: queda como 'error'
```

### Estados de sync

| Estado | Significado |
|--------|-------------|
| `local` | Solo en localStorage, sin configurar Supabase |
| `pending` | Guardado local, esperando sync remoto |
| `synced` | Guardado en ambos lados (id remoto = id local) |
| `error` | Fallo al sync, reintentar despues |

## Parser Learning Storage

**Archivo**: `lib/parserLearningStorage.js`

### Local

```js
loadLocalParserLearning() -> { categories: Map, paymentMethods: Map }
saveLocalParserLearningCategory(keyword, category)
saveLocalParserLearningPaymentMethod(keyword, paymentMethod)
```

### Remoto

```js
loadRemoteParserLearning()
saveRemoteParserLearning(category, paymentMethod, rawText)
```

### Merge

```js
mergeParserLearning(local, remote) -> combined
```

Las reglas locales tienen prioridad sobre las remotas.

## Formato de gasto en localStorage

```json
{
  "expenses": [
    {
      "id": "uuid",
      "amount": 4500,
      "description": "super",
      "category": "market",
      "paymentMethod": "debit",
      "installments": null,
      "installment_number": null,
      "statement_month": null,
      "credit_card_id": null,
      "currency": "ARS",
      "spent_at": "2026-06-07T10:00:00.000Z",
      "created_at": "2026-06-07T10:00:00.000Z",
      "syncState": "synced",
      "userId": "uuid-optional"
    }
  ],
  "syncState": [],
  "settings": { ... },
  "parserLearning": {
    "categories": { "super": "market", ... },
    "paymentMethods": { ... }
  }
}
```
