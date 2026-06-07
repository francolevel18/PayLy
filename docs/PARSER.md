# Parser de Gastos

## Ubicacion

**Logica principal**: `components/ExpenseCapture/useExpenseParser.js` (541 lineas)

**Re-exports**: `lib/expenseParser.js`

**Aprendizaje**: `lib/parserLearningStorage.js`

## Como funciona

### Entrada → Salida

```
"4500 en el super con debito"
  |
  v
{
  amount: 4500,
  description: "super",
  category: "market",
  paymentMethod: "debit",
  installments: null,
  paymentMethodInferred: false
}
```

### Fases del parseo

```
Texto crudo
    |
    v
1. getLearningKeyword(rawText)
    - Extrae el "keyword" (palabra clave) para aprendizaje
    - Filtra: minimo 3 chars, sin numeros, sin stop words
    |
    v
2. Aplicar reglas aprendidas
    - Busca keyword en parser_keywords (local + remoto)
    - Si hay match: sugiere categoria / metodo de pago
    |
    v
3. Extraer monto
    - Busca patrones numericos: "$4500", "4500", "4.500"
    - Soporta "lucas", "mil", "k"
    - maxAmount = monto mas alto encontrado
    |
    v
4. Extraer metodo de pago
    - Palabras clave: "efectivo", "cash", "debito", "debito", "credito",
      "credito", "transferencia", "transfer", "tarjeta", "cuotas"
    - "cuotas" + numero = credit + installments
    |
    v
5. Extraer categoria
    - Palabras clave por categoria:
      - food: "comida", "almuerzo", "cena", "desayuno", "restaurant", "delivery"
      - transport: "nafta", "combustible", "sube", "taxi", "uber", "colectivo"
      - market: "super", "supermercado", "chino", "chango", "disco", "carrefour"
      - health: "farmacia", "medico", "medicamentos", "clinica", "hospital"
      - home: "alquiler", "expensas", "luz", "gas", "agua", "internet"
      - services: "seguro", "servicio", "suscripcion", "netflix", "spotify"
      - leisure: "cine", "salida", "viaje", "vacaciones", "juego", "gaming"
      - other: todo lo demas
    |
    v
6. Extraer cuotas
    - Patron: "en 3 cuotas", "en 6 pagos", "3x"
    - Si detecta: installments = numero, paymentMethod = "credit"
    |
    v
7. Formatear resultado
```

## APIs

### `parseExpenseInput(rawText, overrides?)`

```js
const result = parseExpenseInput("4500 en el super con debito");
// {
//   amount: 4500,
//   description: "super",
//   category: "market",
//   paymentMethod: "debit",
//   installments: null,
//   paymentMethodInferred: false,
//   rawText: "4500 en el super con debito"
// }
```

### `useExpenseParser(input, overrides?)`

Hook React que wrappea `parseExpenseInput` y se actualiza cuando cambia el input.

### `applyLearnedParserRules(rules?)`

Aplica reglas de aprendizaje antes del parseo. Las reglas pueden venir de:
- `localStorage` (cargado con `loadLocalParserLearning()`)
- Supabase (cargado con `loadRemoteParserLearning()`)

### `getLearningKeyword(rawText)`

Extrae la palabra clave de un texto para propositos de aprendizaje.

```js
getLearningKeyword("gaste 4500 en el super con debito")
// -> "super"
```

Filtra:
- Palabras de 3+ caracteres
- Sin numeros
- Sin stop words ("con", "en", "el", "la", "los", "las", "un", "una", "y", "de", "del", "para", "que", "por", "se", "no", "me", "te", "lo", "al")
- Prioriza la palabra mas larga

## Categorias validas

| Key | Labels (espanol) |
|-----|-----------------|
| `food` | comida, almuerzo, cena, desayuno, restaurant, delivery, etc. |
| `transport` | nafta, combustible, sube, taxi, uber, colectivo, etc. |
| `market` | super, supermercado, chino, chango, disco, carrefour, etc. |
| `health` | farmacia, medico, medicamentos, clinica, etc. |
| `home` | alquiler, expensas, luz, gas, agua, internet, etc. |
| `services` | seguro, servicio, suscripcion, netflix, spotify, etc. |
| `leisure` | cine, salida, viaje, vacaciones, juego, gaming, etc. |
| `other` | todo lo demas |

Tambien soporta categorias inventadas por el usuario o la IA (ej: "pets", "gaming", "gym").

## Metodos de pago validos

| Key | Labels |
|-----|--------|
| `cash` | efectivo, cash |
| `debit` | debito, debito, deb |
| `credit` | credito, credito, tarjeta, cuotas |
| `transfer` | transferencia, transfer |

## Sistema de Aprendizaje

### Arquitectura

```
Correccion del usuario
      |
      v
rememberParserCorrection(rawText, detected, corrected)
      |
      +---> Actualiza localStorage (categoria y/o metodo)
      +---> Envia a Supabase (si hay sesion)
      |
      v
Proximo parseo: applyLearnedParserRules()
      usa las reglas aprendidas para mejorar resultados
```

### Tablas en Supabase

#### `parser_keywords`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid? | NULL = regla global, valor = regla del usuario |
| keyword | text | Palabra clave (ej: "super") |
| category_id | uuid | FK a categories |
| count | int | Veces que se uso esta regla |
| last_used_at | timestamptz | Ultimo uso |
| updated_at | timestamptz | Ultima actualizacion |

#### `parser_payment_method_keywords`

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid? | NULL = regla global, valor = regla del usuario |
| keyword | text | Palabra clave |
| payment_method_id | uuid | FK a payment_methods |
| count | int | Veces que se uso |
| last_used_at | timestamptz | Ultimo uso |
| updated_at | timestamptz | Ultima actualizacion |

### Reglas importantes

- **NO existe UNIQUE(keyword)**: la unicidad es por `(user_id, keyword, category_id)` o `(user_id, keyword, payment_method_id)`
- **Reglas globales**: `user_id IS NULL`
- **Reglas de usuario**: `user_id = auth.uid()`
- Las reglas de usuario tienen prioridad sobre las globales
- El aprendizaje local se mergea con el remoto en `mergeParserLearning()`

## Tests

`tests/parser.test.js` - 150 lineas, 29+ casos de prueba:

- Parseo basico de "2000 en super"
- Parseo con categoria explicita
- Diferentes formatos de moneda
- Metodo de pago explicito (debito, efectivo, transferencia)
- Cuotas (3 cuotas, 6 cuotas, etc.)
- Montos con "lucas", "k", "mil"
- Aprendizaje de reglas (keyword -> categoria)
- Aprendizaje de metodo de pago
- Limite de maxAmount
