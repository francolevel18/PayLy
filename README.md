# Payly

Payly es una app mobile-first para registrar gastos personales con minima friccion, entender el ritmo de consumo del mes y recibir recordatorios si el usuario se olvida de cargar gastos.

La experiencia principal es:

```text
escribo el gasto -> Payly entiende -> confirmo -> listo
```

El proyecto combina frontend en Next.js/React, almacenamiento local como fallback, Supabase como backend principal y Edge Functions para recordatorios push.

## Indice

- [Filosofia del Sistema](#filosofia-del-sistema)
- [Alcance del Producto](#alcance-del-producto)
- [Arquitectura General](#arquitectura-general)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Modelo de Datos](#modelo-de-datos)
- [Reglas Clave del Sistema](#reglas-clave-del-sistema)
- [Flujo Principal](#flujo-principal)
- [Modulos Funcionales](#modulos-funcionales)
- [Sistema de Notificaciones](#sistema-de-notificaciones)
- [Configuracion del Entorno](#configuracion-del-entorno)
- [Como Correr el Proyecto](#como-correr-el-proyecto)
- [Validacion Minima](#validacion-minima)
- [Como Hacer Cambios Sin Romper Nada](#como-hacer-cambios-sin-romper-nada)
- [Checklist de PR / Version](#checklist-de-pr--version)
- [Problemas Conocidos y Decisiones Importantes](#problemas-conocidos-y-decisiones-importantes)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Glosario Rapido](#glosario-rapido)
- [Para IA / Contexto Persistente](#para-ia--contexto-persistente)

## Filosofia del Sistema

Payly no busca ser un sistema contable pesado. La prioridad es velocidad, claridad y decisiones rapidas.

- Una carga real debe sentirse inmediata.
- El input principal es el centro del producto.
- El parser ayuda, pero el usuario siempre puede corregir.
- La app debe funcionar aunque Supabase falle temporalmente.
- Los modulos nuevos deben ser capas sobre el flujo actual, no sistemas paralelos.
- Radar, Presupuestos y Tarjetas existen para responder "como vengo", no para decorar.
- Deudores es simple: registrar quien debe dinero y cobrar rapido.

Reglas conceptuales importantes:

- `expenses` = dinero que salio.
- `debts` = dinero que tiene que volver.
- Tarjetas es una capa sobre `expenses`, no una tabla paralela de gastos.
- El auto-learning del parser nunca debe bloquear el guardado.
- Las notificaciones ayudan a recordar, no deben ser invasivas.

## Alcance del Producto

Payly tiene una pantalla principal de carga y varios paneles asociados. El usuario no deberia sentir que cambia de sistema: todo parte del gasto y de las decisiones del mes.

### Lo que Payly hace hoy

- Carga rapida de gastos desde texto libre.
- Parseo automatico de monto, descripcion, categoria y metodo de pago.
- Correccion manual de categoria/metodo.
- Auto-learning a partir de correcciones.
- Guardado local-first y sincronizacion con Supabase.
- Timeline con filtros por periodo.
- Radar de gastos para entender ritmo, proyeccion y riesgos.
- Presupuestos por categoria.
- Tarjetas como capa sobre `expenses`.
- Deudores como modulo separado de plata a cobrar.
- Perfil con ingreso estimado.
- Recordatorios configurables con push notifications.
- Modo privacidad para ocultar montos sensibles.
- Captura opcional de ubicacion sin contaminar descripcion.

### Lo que Payly evita

- Formularios largos para cargar gastos.
- Dashboards pesados que no ayuden a decidir.
- Mezclar gastos con deudas.
- Duplicar la logica de `expenses` para tarjetas.
- Depender 100% de Supabase para que la UI funcione.
- Mostrar informacion tecnica de push/sync al usuario final.

## Arquitectura General

```text
Payly
+-- Next.js App Router
|   +-- app/
|   +-- components/ExpenseCapture/
|   +-- lib/
+-- Supabase
|   +-- Auth
|   +-- Postgres + RLS
|   +-- Edge Functions
+-- PWA / Service Worker
|   +-- public/payly-sw.js
+-- Tests
   +-- tests/
```

### Rutas principales

- `app/page.jsx`: entrada principal.
- `app/nueva-carga/page.jsx`: experiencia de carga.
- `app/login/page.jsx`: autenticacion.
- `app/api/places/nearby/route.js`: endpoint interno para resolver lugares.

### Frontend

Stack principal:

- Next.js `16`
- React `19`
- TailwindCSS
- Supabase JS client
- PWA con service worker para push notifications

Pantallas y componentes principales:

- `components/ExpenseCapture.jsx`: contenedor principal.
- `components/ExpenseCapture/ExpenseInput.jsx`: input rapido.
- `components/ExpenseCapture/ExpensePreview.jsx`: preview del gasto parseado.
- `components/ExpenseCapture/SwipeToSave.jsx`: confirmacion por swipe.
- `components/ExpenseCapture/CategorySelector.jsx`: correccion manual de categoria.
- `components/ExpenseCapture/PaymentMethodSelector.jsx`: correccion manual de medio de pago.
- `components/ExpenseCapture/Timeline.jsx`: movimientos y filtros por periodo.
- `components/ExpenseCapture/AnalysisWheel.jsx`: Radar de gastos.
- `components/ExpenseCapture/BudgetsPanel.jsx`: presupuestos.
- `components/ExpenseCapture/CardsPanel.jsx`: tarjetas.
- `components/ExpenseCapture/DebtorsPanel.jsx`: deudores.
- `components/ExpenseCapture/SettingsPanel.jsx`: preferencias, recordatorios y privacidad.

Hooks principales:

- `useExpenseCaptureState.js`: estado de captura, preferencias, ubicacion, perfil y paneles.
- `useExpenseActions.js`: submit, validaciones, guardado y feedback.
- `useExpenseParser.js`: integracion del parser con el estado visual.

### Estado de UI

La captura vive en un flujo unico:

- input actual
- gasto parseado
- categoria seleccionada
- metodo seleccionado
- tarjeta activa si aplica
- ubicacion detectada si aplica
- preferencias de usuario
- estado de sync
- panel activo del menu

Los paneles deben abrirse como capas sobre la experiencia principal, sin romper la carga rapida.

### Capa de Datos

Repositorios en `lib/`:

- `expensesRepository.js`: carga, guardado, edicion, borrado, sync y auto-learning remoto.
- `expensesStorage.js`: fallback local con `localStorage`.
- `expenseParser.js`: parser local y reglas de deteccion.
- `parserLearningStorage.js`: aprendizaje local.
- `profileRepository.js`: perfil, ingreso mensual y configuracion de recordatorios.
- `pushSubscriptionsRepository.js`: suscripciones push.
- `pushNotifications.js`: permisos, service worker, test local y suscripcion.
- `notificationReminders.js`: fallback local mientras la app esta abierta.
- `reminderMessages.js`: textos de notificacion por tono.
- `budgetsRepository.js`: presupuestos con fallback local.
- `cardsRepository.js`: tarjetas y resumen.
- `autoInsights.js`: Auto Insights remotos opcionales con normalizacion y fallback local.
- `futureInstallments.js`: agenda de cuotas futuras con RPC opcional y fallback local.
- `financialRadar.js`: reglas puras para estado `normal` / `warning` / `critical`.
- `debtorsRepository.js`: deudores.
- `debtsRepository.js`: deudas.
- `locationCapture.js`: captura de ubicacion.
- `placeResolver.js`: resolucion de lugar/cercania.
- `timelineGroups.js`: agrupacion de movimientos por periodo.

### Estrategia Local-first

Payly debe seguir siendo usable aunque Supabase este caido o tarde.

Principios:

- Guardar primero en la experiencia local cuando corresponde.
- Intentar persistencia remota sin bloquear la UI.
- Marcar pendientes de sync si falla el remoto.
- Reintentar luego.
- Nunca borrar visualmente un gasto que el usuario acaba de cargar solo porque fallo la red.

Datos locales:

- Gastos recientes y pendientes.
- Preferencias criticas de UX.
- Fallback de parser learning.
- Estado minimo de recordatorios si Supabase no responde.

### Supabase

Supabase provee:

- Auth.
- Base de datos Postgres.
- RLS por `user_id = auth.uid()`.
- Edge Function `send-push-reminders`.
- Tablas para gastos, categorias, metodos de pago, parser learning, presupuestos, tarjetas, deudores, perfil y push subscriptions.

### Edge Functions

Funcion actual:

- `supabase/functions/send-push-reminders/index.ts`

Responsabilidad:

- Ejecutarse por cron cada 30 minutos.
- Buscar usuarios con recordatorios activos.
- Verificar si corresponde enviar push.
- Evitar mas de un recordatorio por dia.
- No enviar si el usuario ya cargo gastos hoy.
- Enviar push usando VAPID y `push_subscriptions`.

## Estructura del Proyecto

```text
app/
  api/places/nearby/route.js
  login/page.jsx
  nueva-carga/page.jsx
  page.jsx

components/
  Auth/
  ExpenseCapture.jsx
  ExpenseCapture/

hooks/
  useAuth.js

lib/
  autoInsights.js
  expensesRepository.js
  expensesStorage.js
  expenseParser.js
  profileRepository.js
  pushNotifications.js
  pushSubscriptionsRepository.js
  ...

public/
  manifest.json
  payly-sw.js
  icons

supabase/
  config.toml
  functions/send-push-reminders/

tests/
  autoInsights.test.js
  financialRadar.test.js
  futureInstallments.test.js
  parser.test.js
  storage.test.js
  timeline.test.js
```

### Convenciones de archivos

- Componentes visuales: `components/ExpenseCapture/*.jsx`.
- Hooks con logica de pantalla: `components/ExpenseCapture/use*.js`.
- Repositorios/remoto/local: `lib/*Repository.js`.
- Helpers puros: `lib/*.js`.
- Tests de reglas criticas: `tests/*.test.js`.

Si se agrega un modulo nuevo, preferir:

```text
components/ExpenseCapture/NuevoPanel.jsx
lib/nuevoRepository.js
```

antes que mezclar toda la logica en `ExpenseCapture.jsx`.

## Modelo de Datos

Este resumen no reemplaza el schema real. Sirve para entender responsabilidades.

### `expenses`

Fuente principal de gastos.

Campos clave:

- `id`
- `user_id`
- `amount`
- `description`
- `raw_text`
- `category_id`
- `payment_method_id`
- `spent_at`
- `currency`
- `source`
- `metadata`
- `credit_card_id`
- `installments`
- `installment_number`
- `statement_month`

Reglas:

- `raw_text` es el texto original que escribio el usuario.
- `description` es el concepto limpio del gasto.
- `metadata.location_name` guarda la ubicacion/lugar detectado.
- `metadata` puede contener datos complementarios, pero no debe pisar campos principales.
- Nunca reemplazar `description` por ubicacion.
- Si se edita un gasto, mantener el mismo `id`.
- `source` ayuda a diagnosticar origen: carga manual, edicion, sync, etc.
- Una compra en cuotas se guarda como una sola fila. No generar una fila por cada cuota.
- En cuotas, `amount` es el total original de la compra.
- `installments` es la cantidad total de cuotas.
- `installment_number` indica la cuota inicial/current que impacta desde `statement_month`.
- `statement_month` es el primer mes de resumen donde impacta la cuota.

Ejemplo conceptual:

```js
{
  id: "uuid",
  user_id: "uuid",
  amount: 4500,
  raw_text: "4500 fiambre",
  description: "fiambre",
  category_id: "...",
  payment_method_id: "...",
  spent_at: "2026-05-02T12:00:00.000Z",
  currency: "ARS",
  metadata: {
    location_name: "Cerca de Juan de Ayolas"
  }
}
```

### `categories`

Catalogo de categorias. El parser trabaja principalmente con `categories.key`.

Keys usadas por la app:

- `food`
- `transport`
- `market`
- `health`
- `home`
- `services`
- `leisure`
- `other`

Notas:

- Algunas instalaciones pueden tener `home` y/o `services`.
- Si se cambia una key, revisar parser, presupuestos, radar e iconos.
- El frontend debe trabajar con keys estables, no con nombres visibles.

### `payment_methods`

Catalogo de medios de pago.

Keys esperadas:

- `cash`
- `debit`
- `credit`
- `transfer`

Regla de parser:

- Sin metodo explicito, usar default claro: `cash`.
- No usar automaticamente el ultimo metodo sin accion del usuario.

### Parser Learning

Tablas:

- `parser_keywords`
- `parser_payment_method_keywords`

Campos esperados:

- `user_id`
- `keyword`
- `category_id` o `payment_method_id`
- `count`
- `last_used_at`
- `updated_at`

Prioridad del parser:

1. Keywords del usuario.
2. Keywords globales.
3. Reglas locales.
4. Fallback.

El aprendizaje remoto debe ser invisible y no bloquear el guardado.

Contrato backend actual:

- RLS de `SELECT`: `user_id = auth.uid() OR user_id IS NULL`.
- RLS de `INSERT`, `UPDATE`, `DELETE`: solo filas propias.
- No debe existir `UNIQUE(keyword)` en tablas de parser learning.
- La unicidad correcta es por usuario + keyword + categoria/metodo, con soporte para keywords globales `user_id IS NULL`.
- El frontend puede seguir usando `select -> update/insert`; una RPC atomica de incremento seria una mejora futura, no requisito urgente.

Reglas de calidad:

- No guardar numeros.
- No guardar palabras de 1 o 2 letras.
- No guardar palabras vacias como `de`, `con`, `en`, `para`.
- No guardar terminos genericos como `gasto` o `pago`.
- Incrementar `count` y actualizar `last_used_at`.
- Si Supabase falla, usar fallback local o ignorar sin cortar el flujo.

### `budgets`

Presupuestos por categoria y mes.

Campos clave:

- `user_id`
- `category_key`
- `amount`
- `currency`
- `period_month`
- `is_active`

Uso:

- Alimenta `BudgetsPanel`.
- Alimenta limites dentro del Radar.
- Debe tener fallback local si Supabase falla.

Estados visuales esperados:

- `0-60%`: controlado.
- `61-85%`: atencion.
- `86-100%`: critico.
- `>100%`: excedido.

### `credit_cards`

Tarjetas del usuario.

Campos clave:

- `user_id`
- `name`
- `brand`
- `bank_name`
- `last_four`
- `credit_limit`
- `closing_day`
- `due_day`
- `is_active`

Uso:

- Tarjetas se muestran como capa sobre `expenses`.
- Los consumos con tarjeta se guardan como gastos normales con `credit_card_id`.

Campos de `expenses` relacionados:

- `credit_card_id`
- `installments`
- `installment_number`
- `statement_month`

Regla de consumo:

- Si el metodo es `credit` y hay tarjeta activa, guardar `credit_card_id`.
- No crear un consumo separado si ya existe un `expense`.

Regla de cuotas:

- Las cuotas futuras son calculo derivado desde `expenses`.
- No crear tabla nueva para cuotas.
- No duplicar gastos.
- El backend puede exponer `get_future_installments(p_months_ahead integer default 6)`.
- El frontend debe tratar esa RPC como fuente remota opcional y mantener fallback local obligatorio.

Ejemplo:

```text
amount = 120000
installments = 6
installment_number = 1
statement_month = 2026-05-01
```

Impacto esperado:

```text
2026-05 -> 20000
2026-06 -> 20000
2026-07 -> 20000
2026-08 -> 20000
2026-09 -> 20000
2026-10 -> 20000
```

### `debtors` y `debts`

Modulo simple para registrar plata que otra persona debe devolver.

Reglas:

- No mezclar con `expenses`.
- `createDebt` crea deuda con `status = pending`.
- `markDebtAsPaid` marca `status = paid` y setea `paid_at`.
- WhatsApp se genera desde el frontend con un mensaje dinamico.

### `user_profiles`

Perfil extendido del usuario.

Campos relevantes:

- `user_id`
- `monthly_income`
- `currency`
- `reminder_enabled`
- `reminder_mode`: `all_day` o `exact_time`
- `reminder_time`
- `reminder_timezone`
- `reminder_tone`: `tranqui`, `picante` o `corto`
- `last_reminder_sent_at`

Uso:

- Radar financiero.
- Dia de oxigeno.
- Recordatorios push.
- Tono de notificaciones.

Si no existe perfil:

- La app no debe bloquear.
- Radar puede mostrar CTA para configurar ingreso.
- Recordatorios pueden usar fallback local hasta que Supabase responda.

### `push_subscriptions`

Suscripciones push del navegador/dispositivo.

Campos esperados por el frontend:

- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `user_agent`
- `is_active`
- `updated_at`

Importante: el frontend no depende de una columna JSON llamada `subscription`.

### RLS

Todas las tablas con datos del usuario deben respetar:

```sql
user_id = auth.uid()
```

Politicas esperadas:

- `SELECT`: solo filas propias, salvo keywords globales donde `user_id is null`.
- `INSERT`: solo si `user_id = auth.uid()`.
- `UPDATE`: solo si `user_id = auth.uid()`.
- `DELETE`: solo si `user_id = auth.uid()`.

Advertencia: la Edge Function usa service role para poder leer perfiles, gastos y suscripciones. Esa key no puede llegar al navegador.

### Contratos de nombres entre frontend y Supabase

El frontend espera camelCase internamente y snake_case en Supabase cuando corresponde.

Ejemplos:

- `creditCardId` <-> `credit_card_id`
- `paymentMethodId` <-> `payment_method_id`
- `statementMonth` <-> `statement_month`
- `monthlyIncome` <-> `monthly_income`
- `reminderTone` <-> `reminder_tone`

Los repositorios son el lugar correcto para mapear entre ambos mundos.

### RPC opcionales

El frontend puede consumir RPCs de Supabase, pero nunca debe depender de ellas para que la experiencia principal funcione.

#### `get_future_installments`

Uso:

```text
public.get_future_installments(p_months_ahead integer default 6)
```

Contrato esperado:

- Usa `auth.uid()`.
- Respeta RLS.
- Devuelve filas con:
  - `month date`
  - `committed_amount numeric`

Reglas frontend:

- Si la RPC responde, puede usarse para cuotas futuras remotas.
- Si la RPC falla, devuelve 0 filas, no hay sesion o Supabase no esta configurado, usar fallback local.
- No mover todo el Radar a backend todavia.
- No mostrar errores tecnicos de la RPC al usuario final.

## Reglas Clave del Sistema

Estas reglas no se deben romper.

- No reemplazar `description` por ubicacion.
- Guardar ubicacion en `metadata.location_name`.
- No bloquear el guardado si falla Supabase.
- No bloquear el guardado si falla el auto-learning.
- Mantener fallback local para gastos y preferencias criticas.
- No duplicar gastos al editar.
- No crear otro sistema de gastos para Tarjetas.
- No mezclar `debts` con `expenses`.
- No exponer `service_role` en frontend.
- No tocar RLS salvo que sea una tarea explicita de backend.
- No romper el flujo rapido de carga.
- No agregar pasos innecesarios para cargar un gasto.
- Mantener UI mobile-first.
- Respetar `prefers-reduced-motion`.
- No mostrar mensajes tecnicos de Supabase/cron al usuario final.
- No consultar rangos enormes desde Timeline/Radar.
- Mantener maximo de 90 dias para filtros personalizados.
- Radar nunca debe romper si Supabase falla.
- Las cuotas futuras influyen como compromiso, no como gasto ya realizado.

## Flujo Principal

### 1. Carga de gasto

1. El usuario escribe algo como:

```text
4500 fiambre
1200 uber mp
10000 comida
```

2. `expenseParser.js` extrae:

- monto
- descripcion limpia
- categoria
- medio de pago

3. El preview se actualiza inmediatamente.

4. Si el parser detecta mal, el usuario corrige categoria o metodo.

5. Al hacer swipe o Enter:

- se valida el monto
- se guarda localmente
- se intenta guardar en Supabase
- se actualiza timeline
- se dispara auto-learning si hubo correccion manual

Contrato de guardado:

```text
input -> parser -> preview -> save local/UI -> save remote -> learning -> feedback
```

Si falla alguna parte no critica:

- falla ubicacion: guardar igual.
- falla auto-learning: guardar igual.
- falla push subscription: guardar igual.
- falla Supabase: mantener local y marcar pendiente.

### 2. Parser y auto-learning

Casos minimos esperados:

```text
4500 fiambre -> food
3400 soda -> food
2500 turrones -> food
2578 pack de internet -> home/services
1200 uber mp -> transport + transfer
pague con tarjeta visa -> credit
10000 comida -> food + cash
```

Reglas de medio de pago:

- `mp` o `transferencia` -> `transfer`
- `tarjeta`, `visa`, `credito` -> `credit`
- `debito` -> `debit`
- sin metodo -> `cash`

### 3. Analisis

Despues de guardar, el gasto alimenta:

- Timeline.
- Radar de gastos.
- Presupuestos.
- Tarjetas si corresponde.
- Metricas locales/remotas.

Analisis no debe ser una pestaña que compita con Timeline. En la UI actual vive como `Radar de gastos`, enfocado en decisiones:

- como vengo este mes
- cuanto gaste
- que categoria pesa mas
- si llego a fin de mes
- cuanto tengo comprometido en cuotas

El Radar calcula estado financiero en frontend con fallback local:

- `normal`
- `warning`
- `critical`

Entradas principales:

- gasto actual del mes
- presupuesto mensual configurado
- ingreso mensual estimado
- proyeccion a fin de mes
- cuotas comprometidas del proximo mes

Si no hay presupuesto configurado, usa ingreso como referencia principal. Si no hay ingreso, muestra CTA para configurarlo y no bloquea la lectura basica.

### 4. Push

Si el usuario tiene recordatorios activos:

- el frontend guarda preferencias en `user_profiles`
- el navegador guarda una suscripcion en `push_subscriptions`
- el cron ejecuta la Edge Function
- la Edge Function decide si corresponde enviar
- el service worker muestra la notificacion

El push no se envia desde el cliente. El cliente solo:

- pide permiso
- registra service worker
- crea suscripcion
- guarda la suscripcion
- permite enviar una prueba local

## Modulos Funcionales

### Carga Rapida

Objetivo:

- Reducir friccion.
- Hacer que el parser se sienta inmediato.
- Permitir correccion manual sin castigar velocidad.

Elementos:

- Input con placeholder dinamico.
- Lectura inteligente debajo del input.
- Preview con monto, descripcion y deteccion.
- Selectores compactos de categoria/metodo.
- Swipe para guardar.
- Feedback breve de guardado.

### Timeline / Movimientos

Objetivo:

- Ver movimientos sin consultas pesadas.
- Filtrar por periodos simples.

Periodos:

- `Hoy`: movimientos del dia actual, agrupados por hora si corresponde.
- `Semana`: ultimos 7 dias, agrupados por dia.
- `Mes`: mes actual.
- `Personalizado`: selector compacto desde/hasta.

Reglas:

- Maximo 90 dias.
- No abrir modal si no hace falta.
- Mostrar resumen del rango: total, cantidad, categoria principal, promedio diario.
- Estado vacio: `Todavia no hay movimientos en este periodo.`

### Radar de Gastos

Objetivo:

- Responder rapidamente: "como vengo este mes?"

Contenido:

- Selector de periodo: este mes / personalizado.
- Card principal `Radar financiero`.
- Estado global: `normal`, `warning` o `critical`.
- Mensaje accionable, no solo numeros.
- Total gastado.
- Ingreso estimado si existe.
- Porcentaje de ingreso o presupuesto consumido.
- Proyeccion de cierre.
- Saldo real estimado si hay ingreso.
- Donut de categorias como contexto.
- Maximo 3 insights visibles.
- Dia de oxigeno.
- Cuotas proximas.
- Medios de pago.
- Limites de presupuesto.

Reglas:

- Si no hay ingreso, mostrar CTA suave para configurarlo.
- Si no hay presupuestos configurados, usar ingreso como referencia principal.
- Si modo privacidad esta activo, ocultar montos con `••••`, pero mantener porcentajes.
- En periodo personalizado, evitar lecturas fuertes basadas en ingreso mensual.
- Cuotas futuras deben restar margen futuro, pero no sumarse al gasto actual.
- Auto Insights puede usar `get_auto_insights` como fuente remota opcional para el mes actual.
- Si `get_auto_insights` falla o no hay sesion, el bloque Insights debe usar el calculo local.
- `get_future_installments` es opcional; el calculo local de `futureInstallments.js` es obligatorio.

### Presupuestos

Objetivo:

- Ayudar a decidir rapido por categoria.

Cada card debe mostrar:

- categoria
- monto gastado
- presupuesto asignado
- porcentaje usado
- barra de progreso
- estado visual
- mensaje breve
- accion para ajustar

Mensajes esperados:

- `Vas bien este mes`
- `Cuida este gasto`
- `Estas cerca del limite`
- `Presupuesto excedido`

### Tarjetas

Objetivo:

- Ver saldos, cierres y consumos sin abandonar la carga rapida.

Debe mostrar:

- nombre
- marca
- saldo a pagar
- disponible
- estado abierta/cerrada
- dias hasta cierre/vencimiento

Flujo:

- Tocar tarjeta -> ver movimientos filtrados por `credit_card_id`.
- `Cargar consumo` -> reutilizar `ExpenseCapture`.
- Preseleccionar metodo `credit` y tarjeta activa.

### Deudores

Objetivo:

- Registrar deudas simples y cobrar rapido.

Flujo:

- Escribir deuda estilo Payly: `1500 pizza`.
- Seleccionar o crear deudor.
- Guardar deuda.
- Ver timeline de deudas.
- Acciones: WhatsApp y marcar cobrada.

Mensaje WhatsApp:

```text
Che {nombre}, no te cuelgues con los ${amount} de {description}
```

### Settings / Preferencias

Debe permitir configurar:

- moneda
- vibracion al guardar
- swipe para guardar
- recordatorio diario
- recordatorio de carga
- modo de recordatorio: todo el dia / horario
- horario exacto
- tono de notificaciones
- ubicacion al guardar
- modo privacidad cuando aplique

La UI de settings debe ser clara para usuario final. No mostrar mensajes como "falta cron" o detalles internos salvo en modo dev.

## Sistema de Notificaciones

Payly tiene dos caminos relacionados pero distintos:

### Test local

El boton "Probar notificacion" verifica que:

- el navegador permite notificaciones
- el service worker esta disponible
- la app puede mostrar una notificacion de prueba

Esto puede funcionar en localhost si el navegador lo permite.

### Push real

Para que el telefono reciba recordatorios aunque la app este cerrada, hacen falta todas estas piezas:

- Sitio servido en contexto seguro (`https` o entorno permitido por el navegador).
- Permiso de notificaciones concedido.
- Service worker registrado (`public/payly-sw.js`).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en frontend.
- Suscripcion guardada en `push_subscriptions`.
- Edge Function desplegada.
- Secretos VAPID configurados en Supabase.
- Cron llamando a la funcion cada 30 minutos.

La Edge Function:

- lee `user_profiles`
- filtra `reminder_enabled = true`
- respeta `reminder_mode`
- respeta `reminder_timezone`
- evita repetir si `last_reminder_sent_at` ya es del dia
- consulta `expenses` para saber si el usuario ya cargo hoy
- envia push con mensajes de `reminderMessages`

Modos:

- `all_day`: Payly chequea durante el dia, entre la manana y la noche.
- `exact_time`: Payly intenta avisar dentro de la ventana del cron para `reminder_time`.

Tonos actuales:

- `tranqui`
- `picante`
- `corto`

### Mensajes de recordatorio

Los textos viven en:

- `lib/reminderMessages.js`

El objetivo es que suenen cercanos y argentinos/correntinos sin parecer mensajes genericos de sistema.

Ejemplos de tono:

```text
Che, {nombre}, no te olvides de cargar tus gastos de hoy.
Che, {nombre}, no te cuelgues con lo que gastaste hoy.
Epa, la billetera esta llorando y no me contaste por que.
```

### Cron

La funcion esta preparada para ejecutarse cada 30 minutos.

Ejemplo conceptual:

```text
*/30 * * * * POST /functions/v1/send-push-reminders
```

Si `CRON_SECRET` esta configurado, el request debe enviar:

```http
x-cron-secret: <valor>
```

Respuesta esperada:

```json
{
  "ok": true,
  "sent": 1,
  "skipped": 3,
  "failed": 0,
  "total_profiles": 4
}
```

### Service Worker

Archivo:

- `public/payly-sw.js`

Responsabilidades:

- escuchar evento `push`
- mostrar notificacion
- abrir `/nueva-carga` al tocar la notificacion

Si se modifica el service worker, puede ser necesario:

- recargar la app
- cerrar y abrir navegador
- revisar Application -> Service Workers en DevTools

## Configuracion del Entorno

Crear `.env.local` en la raiz del proyecto.

### Frontend

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

Opcional para ubicacion/lugares:

```bash
OSM_CONTACT_EMAIL=...
GOOGLE_MAPS_API_KEY=...
```

Notas de ubicacion:

- OpenStreetMap/Nominatim es la opcion rentable por defecto para uso liviano.
- Google Places puede usarse como fallback si se necesita mas precision comercial.
- Las keys sensibles no deben exponerse directo en cliente; usar endpoint interno.
- Si no hay lugar detectado, el gasto igual debe guardarse.

Notas:

- Si se modifica `.env.local`, reiniciar `npm run dev`.
- No commitear valores reales de `.env.local`.
- Las keys publicas `NEXT_PUBLIC_*` son visibles en el navegador.

### Supabase Edge Function

Secrets necesarios en Supabase:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
```

Tambien se acepta:

```bash
APP_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
CRON_SECRET=...
```

Advertencia:

- `SUPABASE_SERVICE_ROLE_KEY` o `APP_SERVICE_ROLE_KEY` nunca deben estar en el frontend.
- Solo deben vivir como secrets de Supabase/servidor.

## Como Correr el Proyecto

Instalar dependencias:

```bash
npm.cmd install
```

Levantar desarrollo:

```bash
npm.cmd run dev
```

Abrir:

```text
http://localhost:3000
```

Build:

```bash
npm.cmd run build
```

Tests:

```bash
npm.cmd run test
npm.cmd run test:parser
npm.cmd run test:storage
npm.cmd run test:timeline
npm.cmd run test:installments
npm.cmd run test:radar
npm.cmd run test:insights
```

Desplegar Edge Function:

```bash
supabase functions deploy send-push-reminders
```

Ejecutar la funcion manualmente debe hacerse con `POST`, no desde la barra del navegador.

Ejemplo local/remoto con `curl`:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/send-push-reminders" \
  -H "Content-Type: application/json"
```

Si usa `CRON_SECRET`:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/send-push-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <secret>"
```

## Validacion Minima

Antes de subir una version, validar:

- Cargar `4500 fiambre`.
- Cargar `1200 uber mp`.
- Cargar `10000 comida`.
- Corregir categoria y confirmar que aprende sin bloquear.
- Guardar sin conexion remota y verificar que no desaparezca.
- Abrir Timeline y revisar Hoy/Semana/Mes.
- Activar modo privacidad y revisar Radar/Presupuestos.
- Probar swipe en mobile y mouse en desktop.
- Probar notificacion local.
- Confirmar que push subscription se guarda si hay sesion.
- Revisar Radar con ingreso configurado, sin ingreso y con presupuestos.
- Revisar Radar con compra en cuotas y confirmar que impacta como compromiso futuro.

Tests disponibles:

```bash
npm.cmd run test:parser
npm.cmd run test:storage
npm.cmd run test:timeline
npm.cmd run test:installments
npm.cmd run test:radar
npm.cmd run test:insights
```

## Como Hacer Cambios Sin Romper Nada

Antes de tocar codigo:

- Identificar si el cambio es UI, parser, datos, sync, Supabase o push.
- Revisar el repositorio correspondiente en `lib/`.
- Mantener el flujo rapido como prioridad.

Para cambios en captura:

- No duplicar logica de parser.
- Reutilizar `useExpenseActions`.
- Mantener `SwipeToSave` y Enter/tap accesibles.
- No cambiar los defaults del parser sin tests.

Para cambios en parser:

- Agregar o actualizar tests en `tests/parser.test.js`.
- Validar casos reales antes de tocar fallback.
- No aprender basura: numeros, palabras vacias, palabras muy cortas o genericas.
- El aprendizaje remoto debe tener fallback silencioso.

Para cambios en Supabase:

- Respetar RLS por `user_id`.
- No exponer service role.
- Mantener compatibilidad local-first.
- Si una tabla opcional falla, la UI principal debe seguir.

Para cambios en notificaciones:

- Separar test local de push real.
- Recordar que permiso del navegador no alcanza: el servidor debe enviar el push.
- Desplegar Edge Function despues de modificarla.
- Verificar secrets y cron.
- No prometer push real si solo se probo `new Notification()`.
- Mantener mensajes de diagnostico tecnico fuera de la UI final.

Para cambios visuales:

- Mobile-first.
- Transiciones cortas: `120-200ms`.
- Animar `opacity` y `transform`.
- No animar `height`/`width`.
- Respetar `prefers-reduced-motion`.

Para cambios en Radar:

- No convertirlo en dashboard pesado.
- Priorizar estado global, proyeccion, presupuesto/ingreso e impacto futuro.
- Mantener donut como contexto, no protagonista.
- No mostrar dia de oxigeno si el periodo es personalizado.
- Mantener `financialRadar.js` como lugar de reglas `normal` / `warning` / `critical`.
- Mantener `futureInstallments.js` como fallback local aunque exista RPC.
- No sumar cuotas futuras al gasto actual; son compromiso futuro.

Para cambios en Tarjetas:

- No duplicar gastos.
- Guardar consumos como `expenses`.
- Filtrar por `credit_card_id`.
- Mantener carga con `ExpenseCapture`.

Para cambios en Deudores:

- No mezclar con `expenses`.
- No agregar parser complejo por ahora.
- Mantener accion WhatsApp simple.

## Checklist de PR / Version

Antes de mergear o subir a GitHub:

- `npm.cmd run test` pasa.
- El build no rompe imports.
- No hay secrets en el diff.
- El parser mantiene los casos minimos.
- El flujo de guardar funciona con y sin Supabase.
- Mobile no corta bottom sheets, modales ni menu.
- El swipe funciona con touch y mouse.
- Las notificaciones no muestran texto tecnico al usuario.
- Si hubo cambios en Edge Function, esta documentado que requiere deploy.
- Si hubo cambios en Supabase, estan listados fuera del README o en una migracion.

## Problemas Conocidos y Decisiones Importantes

- En localhost, una notificacion de prueba puede funcionar, pero eso no prueba el push real con la app cerrada.
- En telefono, push real requiere HTTPS, service worker, permiso, suscripcion guardada, Edge Function y cron.
- Abrir una Edge Function desde el navegador con `GET` puede devolver errores esperados; la funcion esta pensada para `POST`.
- Si aparece un error de schema cache en Supabase, puede hacer falta esperar o refrescar cache despues de modificar columnas.
- `push_subscriptions` usa columnas planas (`endpoint`, `p256dh`, `auth`), no una columna `subscription`.
- `reminder_tone` debe coincidir con los valores aceptados por Supabase y frontend.
- El parser remoto puede desactivarse si detecta problemas de constraint; eso no debe impedir guardar gastos.
- `description` y `metadata.location_name` tienen responsabilidades distintas.
- El modo privacidad oculta montos, pero mantiene porcentajes y estados visibles.
- Tarjetas, cuotas y presupuesto deben leer de `expenses` siempre que sea posible.
- `get_future_installments` es una optimizacion remota opcional; si falla, Radar usa fallback local.
- No volver a crear `UNIQUE(keyword)` en tablas de parser learning.
- `expenses.id` debe tener default `gen_random_uuid()` en Supabase, aunque el frontend normalmente envia `crypto.randomUUID()`.

## Troubleshooting

### La notificacion de prueba funciona, pero el push real no llega

Revisar:

- el sitio esta en HTTPS o contexto seguro
- permiso de notificaciones concedido
- service worker registrado
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` cargada en frontend
- fila creada en `push_subscriptions`
- Edge Function desplegada
- secrets VAPID configurados
- cron ejecutandose
- usuario no cargo gastos hoy
- `last_reminder_sent_at` no corresponde al dia actual

### Error `Missing authorization header` al abrir la funcion

Puede pasar si se abre la Edge Function desde el navegador con `GET` o sin headers. La funcion esta pensada para `POST` desde cron o desde una llamada controlada.

### Error de schema cache en Supabase

Suele ocurrir despues de agregar columnas o cambiar tablas.

Acciones:

- esperar unos minutos
- refrescar schema cache si aplica
- revisar que el frontend no envie columnas inexistentes
- verificar nombres snake_case/camelCase en repositorios

### `reminder_tone` falla al guardar

Revisar que Supabase acepte exactamente los valores:

```text
tranqui
picante
corto
```

Si antes existia otro valor como `cercano`, normalizarlo en frontend o migrarlo en Supabase.

### El parser remoto se desactiva

Puede pasar si falta un constraint compatible con `upsert` o `onConflict`.

La app debe:

- guardar el gasto igual
- loggear en dev
- seguir con parser local
- no mostrar error tecnico al usuario

### Radar no muestra cuotas futuras

Revisar:

- el gasto tiene `paymentMethod = credit` o `creditCardId`
- `installments > 1`
- `installmentNumber` no supera `installments`
- `statementMonth` existe y representa el mes donde empieza a impactar
- si la RPC falla, `lib/futureInstallments.js` debe calcular fallback local
- las cuotas futuras se muestran como compromiso del proximo mes, no como gasto actual

### Se guardan gastos como transferencia sin indicarlo

Revisar:

- default de metodo
- si se esta reutilizando el ultimo metodo
- reglas de parser
- tests de `expenseParser`

Regla actual: sin metodo explicito, usar `cash`.

### La ubicacion pisa la descripcion

Eso es un bug.

Regla:

```text
raw_text = texto original
description = concepto limpio
metadata.location_name = lugar detectado
```

### El menu o bottom sheet se corta en mobile

Revisar:

- `max-height`
- `overflow-y-auto`
- `safe-area-inset-bottom`
- padding inferior
- pantallas chicas
- teclado abierto

## Roadmap

Proximos pasos razonables:

- Terminar monitoreo del cron de recordatorios.
- Agregar diagnostico seguro de push/sync para desarrollo.
- Mejorar parser con mas casos reales y tests.
- Agregar carga/edicion completa de cuotas desde la UI.
- Profundizar calculos de cuotas por cierre/vencimiento de tarjeta.
- Crear RPC atomica opcional para incrementar parser learning.
- Mejorar configuracion de tonos de notificacion.
- Sumar edicion de perfil mas completa.
- Evolucion futura de Deudores: deteccion automatica de deudor en texto.
- Evolucion futura de captura: OCR o IA, sin romper la carga rapida.

## Glosario Rapido

- `raw_text`: texto original escrito por el usuario.
- `description`: concepto limpio del gasto.
- `metadata.location_name`: ubicacion/lugar detectado.
- `pending sync`: gasto guardado localmente que falta sincronizar.
- `Radar`: panel de decision financiera.
- `Dia de oxigeno`: estimacion de hasta que dia alcanza el ingreso al ritmo actual.
- `Cuotas proximas`: impacto futuro de compras en cuotas.
- `Compromiso futuro`: monto que impactara en proximos resumenes, sin contarlo como gasto ya realizado.
- `get_future_installments`: RPC opcional para calcular cuotas futuras desde Supabase.
- `service role`: key privada de Supabase solo para backend/Edge Functions.
- `VAPID`: claves necesarias para Web Push.

## Para IA / Contexto Persistente

Si una IA trabaja sobre Payly, debe asumir estas reglas como persistentes:

- Payly es local-first: si Supabase falla, la app no debe perder ni ocultar gastos.
- No modificar schema ni RLS salvo pedido explicito.
- No exponer secrets privadas en codigo cliente.
- No reemplazar `description` por ubicacion.
- Usar `metadata.location_name` para lugar detectado.
- No bloquear guardado por errores de parser learning, push o ubicacion.
- No mezclar `expenses` con `debts`.
- No crear un sistema paralelo de consumos para tarjetas.
- No crear tabla paralela de cuotas; derivarlas desde `expenses`.
- No cambiar el flujo principal sin preservar: input -> preview -> correccion -> swipe/guardar.
- Si se toca parser, actualizar tests.
- Si se toca Radar, actualizar `tests/financialRadar.test.js`.
- Si se toca cuotas futuras, actualizar `tests/futureInstallments.test.js`.
- Si se toca push, diferenciar test local de push real.
- Si se toca Edge Function, recordar que requiere deploy y secrets.
- Mantener UI mobile-first y rapida.

Contexto de producto que debe preservar:

- Payly no es una planilla.
- Payly no es un banco.
- Payly no es un ERP personal.
- Payly es una app para cargar rapido, entender el mes y corregir el rumbo.

Checklist mental antes de editar:

- Esto agrega friccion?
- Esto duplica una fuente de verdad?
- Esto puede romper local-first?
- Esto mezcla descripcion con ubicacion?
- Esto expone un secreto?
- Esto necesita test de parser?
- Esto necesita deploy de Edge Function?

Orden recomendado para trabajar:

1. Leer el componente o repositorio afectado.
2. Entender si hay fallback local.
3. Hacer cambios chicos y compatibles.
4. Correr tests relevantes.
5. Verificar que la carga rapida siga funcionando.

Frase guia:

```text
Payly tiene que sentirse como cargar un gasto en segundos, no como completar un formulario.
```
