# Componentes

## Estructura

```
components/
├── Auth/
│   ├── AuthGuard.jsx
│   └── SignInDialog.jsx
├── ExpenseCapture/
│   ├── AIChatSheet.jsx
│   ├── AnalysisWheel.jsx
│   ├── ExpenseInput.jsx
│   ├── ExpenseItem.jsx
│   ├── ExpenseList.jsx
│   ├── ExpensesPageContent.jsx
│   ├── Timeline.jsx
│   ├── hooks/
│   │   ├── useExpenseParser.js
│   │   ├── useExpenseCaptureState.js
│   │   ├── useExpenseActions.js
│   │   └── useTimelineGrouping.js
│   └── modals/
│       ├── ExpenseModal.jsx
│       └── ExpensePreviewModal.jsx
├── Dashboard/
│   ├── BudgetView.jsx
│   ├── CreditCardSummary.jsx
│   ├── DebtorsView.jsx
│   └── EmptyState.jsx
├── Settings/
│   ├── ReminderSettings.jsx
│   └── UserProfileView.jsx
├── layout/
│   ├── Sidebar.jsx
│   └── WeeklyNavigation.jsx
├── ui/
│   ├── AlertDialog.jsx
│   ├── ConfirmDialog.jsx
│   ├── InstallPWA.jsx
│   └── PullToRefresh.jsx
└── providers/
    └── NotificationProvider.jsx
```

## Componentes Principales

### `ExpensesPageContent.jsx`

Orquestador principal. Renderiza `ExpenseInput`, `ExpenseList`, `Timeline` y maneja los hooks.

```jsx
// Estado via useExpenseCaptureState:
{
  expenses,           // Gastos actuales
  categories,         // Categorias cargadas
  paymentMethods,     // Metodos de pago
  categoriesBudget,   // Budgets cargados
  settings,           // Preferencias del usuario
  syncState,          // Estado de sincronizacion { local, pending, error }
  isOnline            // Estado de conexion
}
```

### `ExpenseInput.jsx`

Input principal de texto. Soporta Ctrl+Enter para enviar al chat.

Componentes internos:
- `InputCategory` - selector de categoria
- `InputPaymentMethod` - selector de metodo de pago
- `InputAmount` - display del monto parseado
- `CurrentMonth` - resumen del mes actual
- `LastWeekExpenses` - gastos recientes

### `AIChatSheet.jsx`

Panel de chat lateral. Usa `useChat` de `@ai-sdk/react v3`.

Estados visuales:
- **Inicial**: mensaje de bienvenida animado
- **Esperando input**: placeholder "Ej: gaste 4500 en el super..."
- **Streaming**: dots animados
- **Tool ejecutandose**: spin
- **Tool completada**: check animation

Control de apertura:
- Input largo + 0 matches de parser local -> abre el panel
- Ctrl+Enter -> abre el panel
- Clic en boton de IA -> abre el panel

### `ExpensePreviewModal.jsx`

Modal de previsualizacion antes de confirmar un gasto del chat.

Campos editables:
- description (texto)
- amount (numero)
- category (selector)
- paymentMethod (selector)
- creditCard (selector condicional)

### `Timeline.jsx`

Linea de tiempo que agrupa gastos por periodo.

Estados: last_24h, earlier_this_week, last_week, this_month, older.

### `AnalysisWheel.jsx`

Radar financiero circular.

Estados:
- **normal**: todo en verde
- **warning**: algunos limites cerca
- **critical**: presupuesto excedido
- **vacio**: "Todavia no hay datos suficientes para analizar"

Segmentos:
- monthlyIncome (verde)
- spentSoFar (naranja)
- futureInstallments (rojo)
- remainingBudget (verde claro)
- savingsPotential (violeta)

### `ExpenseItem.jsx`

Fila individual de gasto.

Muestra:
- descripcion
- monto formateado
- categoria (con icono)
- metodo de pago
- cuotas (si aplica)
- badge de syncState

### `PullToRefresh.jsx`

Pull-to-refresh nativo con soporte iOS.

## Modales

### `ExpenseModal.jsx`

Modal de detalle de gasto (vista y edicion).

Campos: description, amount, category (select con busqueda), paymentMethod (radio group), creditCard (select condicional), spentAt (date picker), installments (solo credit), notes.

### `ExpensePreviewModal.jsx`

Previsualizacion tras chat. Similar a ExpenseModal pero mas simple.

## Hooks

### `useExpenseCaptureState.js`

Hook central de estado. Orquesta:

```js
const {
  expenses, setExpenses,
  categories, paymentMethods,
  settings, syncState, isOnline,
  loading, error
} = useExpenseCaptureState(user);
```

Flujo de carga:
1. `loadLocalExpenses()` -> gastos de localStorage
2. `loadLocalSettings()` -> preferencias
3. Si hay sesion: `loadRemoteExpenses()` -> merge local + remoto
4. Si hay sesion: `loadRemoteCategories()`, `loadRemotePaymentMethods()`
5. Almacena en cache (Catalog Cache)

### `useExpenseActions.js`

Acciones CRUD con soporte de undo y sync.

```js
const { addExpense, editExpense, removeExpense, undoRemove } = useExpenseActions({
  expenses, setExpenses, categories, paymentMethods, settings, syncState, user
});
```

- `addExpense`: guarda local, sync remoto
- `editExpense`: actualiza local, sync remoto
- `removeExpense`: guarda historial para undo, elimina local, sync remoto
- `undoRemove`: restaura del historial

### `useTimelineGrouping.js`

Agrupa gastos por periodo de tiempo.

```js
const { periods, timeframe, setTimeframe } = useTimelineGrouping(expenses);
```

Periodos: `last_24h`, `earlier_this_week`, `last_week`, `this_month`, `older`.

## Providers

### `NotificationProvider.jsx`

Gestiona el registro de Service Worker y push notifications.

```jsx
<NotificationProvider>
  {children}
</NotificationProvider>
```

- Solicita permiso de notificaciones
- Registra el SW
- Suscribe a push
- Escucha clicks en notificaciones
