# Base de Datos

Supabase (Postgres) es el backend. El schema se define en Supabase Studio (sin migraciones versionadas en el repo).

## Tablas

### `expenses` — Tabla principal

| Columna | Tipo | Default | Restriccion |
|---------|------|---------|-------------|
| id | uuid | `gen_random_uuid()` | PK |
| user_id | uuid | - | FK -> auth.users, NOT NULL |
| amount | numeric(12,2) | - | NOT NULL |
| description | text | - | NOT NULL |
| raw_text | text | - | |
| category_id | uuid | - | FK -> categories |
| payment_method_id | uuid | - | FK -> payment_methods |
| spent_at | timestamptz | `now()` | |
| currency | text | `'ARS'` | |
| source | text | `'manual'` | |
| credit_card_id | uuid | - | FK -> credit_cards |
| installments | int | `1` | |
| installment_number | int | - | |
| statement_month | date | - | |
| metadata | jsonb | `{}` | |
| created_at | timestamptz | `now()` | |

### `categories`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| key | text | UNIQUE. Valores: food, transport, market, health, home, services, leisure, other |

### `payment_methods`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| key | text | UNIQUE. Valores: cash, debit, credit, transfer |

### `parser_keywords`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid? | NULL = regla global |
| keyword | text | Palabra a aprender |
| category_id | uuid | FK -> categories |
| count | int | Peso de la regla |
| last_used_at | timestamptz | |
| updated_at | timestamptz | |

### `parser_payment_method_keywords`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid? | NULL = regla global |
| keyword | text | Palabra a aprender |
| payment_method_id | uuid | FK -> payment_methods |
| count | int | Peso de la regla |
| last_used_at | timestamptz | |
| updated_at | timestamptz | |

### `budgets`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK -> auth.users |
| category_key | text | |
| amount | numeric | |
| currency | text | |
| period_month | date | |
| is_active | boolean | |
| updated_at | timestamptz | |

### `credit_cards`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK -> auth.users |
| name | text | |
| brand | text | |
| bank_name | text | |
| last_four | text | |
| credit_limit | numeric | |
| closing_day | int | |
| due_day | int | |
| is_active | boolean | |

### `debtors`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK -> auth.users |
| name | text | |
| phone | text | |
| avatar_url | text | |

### `debts`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK -> auth.users |
| debtor_id | uuid | FK -> debtors |
| amount | numeric | |
| description | text | |
| due_date | date | |
| status | text | |
| paid_at | timestamptz | |

### `user_profiles`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK -> auth.users, UNIQUE |
| monthly_income | numeric | |
| currency | text | |
| reminder_enabled | boolean | |
| reminder_mode | text | 'daily' |
| reminder_time | text | '21:00' |
| reminder_timezone | text | |
| reminder_tone | text | 'tranqui' |
| last_reminder_sent_at | timestamptz | |

### `push_subscriptions`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK -> auth.users |
| endpoint | text | |
| p256dh | text | |
| auth | text | |
| user_agent | text | |
| is_active | boolean | |
| updated_at | timestamptz | |

## RLS (Row Level Security)

Todas las tablas con `user_id` usan el mismo patron:

```sql
-- SELECT
CREATE POLICY "Users can view own rows"
ON expenses FOR SELECT
USING (user_id = auth.uid());

-- INSERT
CREATE POLICY "Users can insert own rows"
ON expenses FOR INSERT
WITH CHECK (user_id = auth.uid());

-- UPDATE
CREATE POLICY "Users can update own rows"
ON expenses FOR UPDATE
USING (user_id = auth.uid());

-- DELETE
CREATE POLICY "Users can delete own rows"
ON expenses FOR DELETE
USING (user_id = auth.uid());
```

Para `parser_keywords` y `parser_payment_method_keywords`:
```sql
-- SELECT permite NULL (reglas globales) y propias
USING (user_id = auth.uid() OR user_id IS NULL);
```

## RPCs (Remote Procedure Calls)

### `get_auto_insights()`

Retorna insights sobre gastos del mes actual.

```sql
CREATE OR REPLACE FUNCTION get_auto_insights()
RETURNS TABLE (
  type text,
  category text,
  title text,
  message text,
  severity text
) LANGUAGE sql STABLE
AS $$
  -- Implementacion interna en Supabase
  -- Calcula: top_category, budget_pace, future_installments_pressure, payment_method_dominance
$$;
```

**Uso**: No guarda resultados. Se calcula dinamicamente.

**Fallback local**: `lib/autoInsights.js` -> `normalizeAutoInsights()`

### `get_future_installments(p_months_ahead int default 6)`

Calcula cuotas futuras comprometidas.

```sql
CREATE OR REPLACE FUNCTION get_future_installments(
  p_months_ahead int default 6
)
RETURNS TABLE (
  month date,
  total_amount numeric,
  installment_count bigint,
  credit_card_name text
) LANGUAGE sql STABLE
AS $$
  -- Proyecta cuotas futuras desde expenses donde installments > installment_number
$$;
```

**Fallback local**: `lib/futureInstallments.js` -> `buildFutureInstallmentSchedule()`

### `get_push_radar_state()`

Estado del radar financiero para push notifications.

```sql
CREATE OR REPLACE FUNCTION get_push_radar_state()
RETURNS TABLE (
  user_id uuid,
  status text,
  message text
) LANGUAGE sql STABLE
AS $$ ... $$;

-- Version por usuario:
CREATE OR REPLACE FUNCTION get_push_radar_state_for_user(
  p_user_id text
) RETURNS TABLE (
  status text,
  message text
) LANGUAGE sql STABLE
AS $$ ... $$;
```

**Uso**: Edge Function `send-push-reminders` usa `get_push_radar_state_for_user()`.

## Edge Functions

### `send-push-reminders`

- Cron: se ejecuta periodicamente
- Llama `get_push_radar_state_for_user()` para cada usuario
- Envia push notifications via Web Push API
- Tonos: tranqui, picante, corto
- Ubicacion: `supabase/functions/send-push-reminders/`

## Modelo de Cuotas

Una compra en cuotas = **una fila** en `expenses`.

```
amount = 120000
installments = 6
installment_number = 1
statement_month = "2026-05-01"
```

Las cuotas futuras se calculan dinamicamente. No se crean filas futuras.

Calculo:
```js
// lib/futureInstallments.js
for (let i = installmentNumber; i < installments; i++) {
  const month = addMonths(statementMonth, i - installmentNumber + 1);
  schedule[month] += amount / installments;
}
```
