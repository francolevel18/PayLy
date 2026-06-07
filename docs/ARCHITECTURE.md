# Arquitectura

## Principios

1. **Local-first**: Todo funciona sin conexion. Supabase es opcional/mejora progresiva.
2. **Single source of truth**: `expenses` es la unica tabla de gastos. Las cuotas futuras se calculan, no se almacenan.
3. **Parser > Formulario**: La UI prioriza el input de texto libre sobre formularios estructurados.

## Flujo de Datos

```
Usuario escribe
      |
      v
[Input de texto]
      |
      +---> Parser local (useExpenseParser)
      |       |
      |       +---> Extrae: monto, categoria, metodo de pago, cuotas
      |       +---> Aplica reglas aprendidas (parser_keywords)
      |       |
      |       v
      |   [Preview] ---> Preview visual ---> [Confirmar / Corregir]
      |       |                                      |
      |       +---> Si confirma: saveLocalExpense()  |
      |       +---> Si corrige: rememberCorrection() |
      |                                              |
      +---> Chat IA (AIChatSheet -> /api/chat)
              |
              +---> Gemini interpreta texto
              +---> saveExpense tool (cuando confirma)
              |
              v
          [Frontend intercepta tool call]
              |
              +---> saveLocalExpense() (localStorage)
              +---> saveRemoteExpense() (Supabase async)
```

## Capas

### 1. UI Layer (`components/ExpenseCapture/`)

Componentes React con estado local via hooks.

- `useExpenseCaptureState.js`: estado central (gastos, UI, sync)
- `useExpenseParser.js`: logica del parser (pure functions + React hook)
- `useExpenseActions.js`: acciones CRUD con undo

### 2. Data Layer (`lib/`)

Funciones puras y acceso a datos.

```
lib/
  expensesStorage.js     -> localStorage (siempre disponible)
  expensesRepository.js  -> Supabase (cuando hay sesion)
  parserLearningStorage.js -> aprendizaje local + merge remoto
  financialRadar.js      -> calculo puro, sin efectos
  futureInstallments.js  -> calculo puro, con fallback RPC
  autoInsights.js        -> RPC con fallback local
```

### 3. API Layer (`app/api/`)

Endpoints de Next.js App Router.

| Endpoint | Metodo | Funcion |
|----------|--------|---------|
| `/api/chat` | POST | Streaming chat con Gemini |
| `/api/places/nearby` | POST | Resolucion de coordenadas a lugar |

### 4. Backend Layer (Supabase)

Servicios externos opcionales.

```
Supabase
  ├─ Auth: Google OAuth / Email / Magic Link
  ├─ Postgres: expenses, categories, payment_methods, parser_keywords, etc.
  ├─ RLS: row-level security por user_id
  ├─ RPCs: get_auto_insights, get_future_installments, get_push_radar_state
  └─ Edge Functions: send-push-reminders (cron)
```

## Sincronizacion

### Local -> Remoto

1. Todo gasto se guarda primero en localStorage
2. Si hay sesion activa, se marca como `pending`
3. Un proceso async intenta guardar en Supabase
4. Si ok -> `synced`. Si falla -> `error` (con retry)

### Offline

- Sin conexion: todo funciona con localStorage
- Al reconectar: `migrateLocalExpenses()` sincroniza pendientes
- Sin Supabase configurado: app 100% funcional con datos locales

## Patrones Clave

### Catalog Cache

```js
// lib/expensesRepository.js
const categoryByKey = new Map();
const paymentMethodByKey = new Map();

// Se cargan una vez desde Supabase
// Mapean: key -> id (UUID de la tabla)
categoryByKey.get("food") // -> uuid
```

### Local First Fallback

```js
// Cada repository exporta funciones load/save locales
// y load/save remotas. Las locales siempre funcionan.
loadExpenses()           // localStorage
loadRemoteExpenses()     // Supabase (falla silenciosamente si no hay conexion)
```

### Estado de Sincronizacion

Cada gasto tiene un `syncState`:

| Estado | Significado |
|--------|-------------|
| `local` | Solo en localStorage, sin conexion configurada |
| `pending` | Esperando sincronizar con Supabase |
| `synced` | Guardado en ambos lados |
| `error` | Fallo al sincronizar (con retry) |
