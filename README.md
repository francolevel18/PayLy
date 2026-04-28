# Payly

MVP frontend mobile-first para cargar gastos personales con minima friccion.

## Estado

Fase 1: frontend MVP completado.

Fase 2: integracion Supabase iniciada. El frontend mantiene `localStorage` como fallback rapido y sincroniza con Supabase cuando hay sesion activa.

## Flujo principal

1. Abrir la app.
2. Escribir un gasto en un unico input, por ejemplo `4500 comida`.
3. Revisar el preview.
4. Guardar.

Regla de oro: una carga real debe tomar menos de 3 segundos.

## Comandos

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run test
npm.cmd run test:parser
npm.cmd run test:storage
```

## Supabase

Crear un archivo `.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

Tablas esperadas por el frontend:

- `profiles`
- `expenses`
- `categories`
- `payment_methods`

Campos clave para `expenses`:

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

Catalogos esperados:

- `categories.key`: `food`, `transport`, `market`, `health`, `home`, `other`
- `payment_methods.key`: `cash`, `debit`, `credit`, `transfer`

Comportamiento actual:

- Sin variables de Supabase: modo local-only.
- Sin sesion activa: guarda y lee desde `localStorage`.
- Con sesion activa: carga gastos remotos, migra gastos locales si el remoto esta vacio y guarda/borrar tambien en Supabase.

## Validacion minima

Parser obligatorio antes de congelar Fase 1:

- `4500 comida` -> monto `4500`, categoria `food`, medio `cash`
- `uber 3200 mp` -> monto `3200`, categoria `transport`, medio `transfer`

Prueba mobile bloqueante:

- Android con teclado abierto
- iOS con teclado abierto
- preview visible
- boton guardar accesible
- chips visibles en dos filas
- swipe left no compite con scroll vertical

Cronometro de carga:

- `4500 comida`
- `uber 3200 mp`
- `super 12000 debito`
- `cafe 900`
- `nafta 8000 credito`

Las 5 cargas deben quedar debajo de 3 segundos cada una.

## Fuera de fase

- OCR
- IA/NLP avanzado
- Edicion completa de gastos historicos
