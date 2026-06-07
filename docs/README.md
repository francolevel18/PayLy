# Payly

Asistente financiero personal local-first. Carga rapida de gastos con IA.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16 + React 19 + TailwindCSS 4 |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| IA | Gemini 2.5 Flash + Vercel AI SDK v6 |
| Cliente AI | @ai-sdk/react v3 |
| Esquemas | Zod v4 |
| PWA | Service Worker + Web Push |
| Testing | Node.js (tests unitarios puros) |

## Filosofia

```
Escribo -> Payly entiende -> guarda -> aprende
```

- Local-first: los gastos se guardan en localStorage y se sincronizan con Supabase cuando hay conexion.
- Sin friccion: el usuario escribe en lenguaje natural, Payly interpreta.
- Auto-aprendizaje: las correcciones del usuario mejoran el parser con el tiempo.

## Quick Start

```bash
npm install
cp .env.example .env.local  # Completar vars
npm run dev
```

## Variables de Entorno

| Variable | Requerida | Uso |
|----------|-----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Si | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | Key anonima de Supabase |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Si | API key de Gemini |
| `GOOGLE_MAPS_API_KEY` | No | Fallback para geocoding |

## Scripts

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build de produccion
npm test                 # Suite completa de tests
npm run test:parser      # Tests del parser
npm run test:storage     # Tests de storage local
npm run test:timeline    # Tests de agrupacion temporal
npm run test:installments # Tests de cuotas futuras
npm run test:radar       # Tests de radar financiero
npm run test:insights    # Tests de auto insights
```

## Estructura del Proyecto

```
app/                      # Next.js App Router
  api/chat/              #   Chat IA con Gemini
  api/places/nearby/     #   Geocoding inverso
  login/                 #   Login
  nueva-carga/           #   Captura de gastos
components/
  Auth/                  # Componentes de autenticacion
  ExpenseCapture/        # Componentes principales de la app
    AIChatSheet.jsx      #   Panel de chat IA
    ExpenseInput.jsx     #   Input de texto para gastos
    Timeline.jsx         #   Linea de tiempo de gastos
    AnalysisWheel.jsx    #   Radar financiero
    ...
hooks/
  useAuth.js             # Hook de autenticacion
lib/
  expenseParser.js       # Parser de gastos en lenguaje natural
  expensesRepository.js  # CRUD remoto de gastos
  expensesStorage.js     # Persistencia local (localStorage)
  financialRadar.js      # Calculo de estado financiero
  futureInstallments.js  # Calculo de cuotas futuras
  autoInsights.js        # Insights automaticos
  budgetsRepository.js   # Presupuestos
  cardsRepository.js     # Tarjetas de credito
  ...
supabase/
  functions/             # Edge Functions
    send-push-reminders/ #   Recordatorios push por cron
tests/                   # Tests unitarios
public/                  # Assets estaticos + PWA
docs/                    # Documentacion
```

## Features

- **Chat IA**: interpreta gastos en lenguaje natural, guarda automaticamente
- **Parser local**: extrae monto, categoria, metodo de pago y cuotas
- **Auto-aprendizaje**: corrige y recuerda patrones del usuario
- **Radar financiero**: estado normal/warning/critical basado en gasto vs presupuesto
- **Cuotas**: compras en cuotas en una sola fila, calculo dinamico de cuotas futuras
- **Auto Insights**: sugerencias inteligentes sobre habitos de gasto
- **Presupuestos**: por categoria, mensuales
- **Tarjetas de credito**: resumen, saldo, dias de cierre
- **Deudores**: seguimiento de deudas con integracion WhatsApp
- **Recordatorios**: notificaciones push + browser con tonos configurables
- **PWA**: instalable, offline, push notifications
