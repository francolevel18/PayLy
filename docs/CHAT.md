# Chat IA

## Stack

| Paquete | Version | Funcion |
|---------|---------|---------|
| `ai` | 6.0.197 | SDK principal (`streamText`) |
| `@ai-sdk/google` | 3.0.80 | Provider Google Generative AI |
| `@ai-sdk/react` | 3.0.199 | Hook `useChat` para React |
| `zod` | 4.4.3 | Esquemas de validacion de tools |

## Archivos

| Archivo | Rol |
|---------|-----|
| `app/api/chat/route.js` | API Route que recibe mensajes y streamea respuesta de Gemini |
| `components/ExpenseCapture/AIChatSheet.jsx` | Panel UI del chat con animaciones |

## API: `POST /api/chat`

### Request

```json
{
  "messages": [
    {
      "id": "msg_abc",
      "role": "user",
      "parts": [{ "type": "text", "text": "gaste 4500 en el super con debito" }]
    }
  ]
}
```

### Response

Stream en formato UIMessage (SSE). Usa `streamText().toUIMessageStreamResponse()`.

### Flujo interno (`route.js`)

```
Request (UIMessage[])
      |
      v
convertToModelMessages(messages)
      |
      v
streamText({
    model: google('gemini-2.5-flash'),
    system: "...",
    messages: modelMessages,
    tools: { saveExpense: { inputSchema: z.object(...) } }
})
      |
      v
result.toUIMessageStreamResponse()
```

### Tool: `saveExpense`

```js
{
  description: 'Guarda un gasto en el sistema...',
  inputSchema: z.object({
    amount: z.number().positive().describe('El monto del gasto'),
    description: z.string().describe('Descripcion corta'),
    category: z.string().describe('Categoria del gasto'),
    paymentMethod: z.enum(["cash","debit","credit","transfer"]).describe('Metodo de pago'),
    installments: z.number().int().min(1).max(24).optional().describe('Cuotas'),
    date: z.string().optional().describe('Fecha ISO 8601 si fue en el pasado'),
  })
}
```

## Cliente: `AIChatSheet.jsx`

### Hook `useChat`

```js
const { messages, sendMessage, status, addToolOutput } = useChat({
  api: '/api/chat',
  onToolCall: async ({ toolCall }) => { ... },
  sendAutomaticallyWhen: ({ messages }) => { ... },
});
```

### API v3 (actual - @ai-sdk/react v3)

| Propiedad | Tipo | Descripcion |
|-----------|------|-------------|
| `messages` | `UIMessage[]` | Mensajes con `parts` (no `content`/`toolInvocations`) |
| `sendMessage` | `({ text }) => void` | Envia un mensaje al chat |
| `status` | `'submitted' | 'streaming' | 'ready' | 'error'` | Estado del chat |
| `addToolOutput` | `({ tool, toolCallId, state, output }) => void` | Provee resultado de tool |
| `error` | `Error \| undefined` | Error si lo hay |

### Diferencia con API anterior

| Concepto | API vieja | API v3 |
|----------|-----------|--------|
| Import | `import { useChat } from 'ai/react'` | `import { useChat } from '@ai-sdk/react'` |
| Envio | `handleSubmit` + `input` + `handleInputChange` | `sendMessage({ text })` |
| Estado | `isLoading` (boolean) | `status` (submitted/streaming/ready/error) |
| Tools | `onToolCall` retorna string | `onToolCall` usa `addToolOutput({...})` |
| Argumentos | `toolCall.args` | `toolCall.input` |
| Mensajes | `.content`, `.toolInvocations` | `.parts[]` (text, tool-*, reasoning, etc.) |
| Auto-envio | `maxSteps: number` | `sendAutomaticallyWhen: ({messages}) => boolean` |

### Flujo de Tool Call

```
1. Usuario envia: "gaste 4500 en el super"
2. Gemini responde con tool call saveExpense({ amount: 4500, description: "super", ... })
3. La tool call llega al frontend via el stream
4. onToolCall se dispara con toolCall.input
5. Se ejecuta saveRemoteExpense() (async)
6. Se llama addToolOutput({ tool, toolCallId, state: 'output-available', output })
7. sendAutomaticallyWhen retorna true (hay tools completadas, sin texto aun)
8. Se envia de vuelta a Gemini con el resultado de la tool
9. Gemini responde con confirmacion: "Listo rey!"
```

### `sendAutomaticallyWhen`

Reemplaza `maxSteps` de la API vieja. Decide cuando re-enviar mensajes a la IA despues de ejecutar una tool.

```js
sendAutomaticallyWhen: ({ messages }) => {
  // Busca el ultimo mensaje del asistente con tools
  const lastAssistant = [...messages].reverse().find(m =>
    m.role === 'assistant' && m.parts?.some(p => p.type.startsWith('tool-'))
  );
  if (!lastAssistant) return false;

  // Re-envia SOLO si hay tools completadas sin texto de respuesta aun
  const hasCompletedTools = lastAssistant.parts?.some(
    p => p.type.startsWith('tool-') && p.state === 'output-available'
  );
  const hasText = lastAssistant.parts?.some(
    p => p.type === 'text' && p.state === 'done'
  );

  return hasCompletedTools && !hasText;
};
```

## System Prompt

El prompt del asistente se organiza en secciones:

| Seccion | Proposito |
|---------|-----------|
| Personalidad | Tono argentino, voseo, emojis moderados |
| Regla #1 - Anticipar contexto | Detecta hora del dia para sugerir gastos comunes |
| Regla #2 - Metodo de pago | Pregunta si no esta explicito (la mas importante) |
| Regla #3 - TC y cuotas | Manejo de tarjeta de credito |
| Regla #4 - Fechas | Calculo de fechas pasadas |
| Regla #5 - Categorias | Seleccion automatica |\n| Regla #6 - Gastos multiples | Procesar varios gastos en uno |
| Regla #7 - Cuando preguntar | Solo si falta informacion critica |
| Regla #8 - Cuando no preguntar | Si ya tiene todos los datos |
| Regla #9 - Manejo de errores | Correcciones del usuario |
| Regla #10 - Sugerencias | Proactivo sobre patrones |
| Ejemplos | 5 interacciones de ejemplo |

## Errores Conocidos y Soluciones

### 1. `handleSubmit` no funciona

**Causa**: `useChat` de `@ai-sdk/react` v3 no retorna `handleSubmit`. En su lugar usa `sendMessage()`.

**Solucion**: 
```js
const { sendMessage } = useChat({...});
// En vez de:
<form onSubmit={handleSubmit}>
// Usar:
<form onSubmit={(e) => { e.preventDefault(); sendMessage({ text: input }); }}>
```

### 2. `null value in column "amount"`

**Causa**: La tool se definia con `parameters` en vez de `inputSchema`. El SDK ignoraba la propiedad y usaba schema vacio.

**Solucion**:
```js
// ANTES (mal)
tools: { saveExpense: { parameters: z.object({...}) } }

// DESPUES (bien)
tools: { saveExpense: { inputSchema: z.object({...}) } }
```

### 3. `The messages do not match the ModelMessage[] schema`

**Causa**: El cliente envia `UIMessage[]` (con `parts`) pero `streamText` espera `ModelMessage[]` (con `content`).

**Solucion**: Usar `convertToModelMessages()` antes de pasar a `streamText`.

### 4. La IA no pregunta el metodo de pago

**Causa**: El prompt era permisivo ("si no sabe, asume cash"). La IA no tenia instrucciones claras de preguntar.

**Solucion**: Prompt con reglas explicitas de cuando preguntar (CASO A/B/C) y descripcion del tool que dice "SOLO usala cuando tengas metodo de pago confirmado".
