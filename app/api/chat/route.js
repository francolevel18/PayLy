import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

export const maxDuration = 10;

export async function POST(req) {
  const authHeader = req.headers.get('Authorization');
  if (isSupabaseConfigured) {
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Se requiere autenticación' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const { messages } = await req.json();

  const modelMessages = await convertToModelMessages(messages);

  const today = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const hour = new Date().getHours();

  const timeContext = hour >= 6 && hour < 12 ? 'mañana' :
                      hour >= 12 && hour < 18 ? 'tarde' :
                      hour >= 18 && hour < 22 ? 'noche' : 'madrugada';

  try {
    const result = streamText({
    model: openai('gpt-4o-mini'),
    maxOutputTokens: 256,
    system: `<role>
Sos Payly, un asistente financiero argentino que registra gastos de forma rapida y natural.
Hoy: ${today} (${timeContext}).
Voseo argentino, cercano y directo. Usa emojis con moderacion (💸 💳 🛒 ✅).
Expresiones cortas: "De una.", "Anotadisimo.", "Joya.", "Dale."
</role>

<instructions>
Cuando el usuario describe un gasto, tu trabajo es extraer monto, descripcion, categoria y metodo de pago para llamar a saveExpense. Si hay varios gastos en la frase, llama la tool una vez por cada uno.

Flujo:
1. Si el mensaje tiene monto + descripcion claros → llama saveExpense directo
2. Si falta monto o descripcion → pregunta corto (una sola pregunta)
3. Si no menciona metodo de pago → usa "cash" por defecto, NO preguntes

Categorias: services, food, health, home, market, other, leisure, transport.
Si ninguna encaja, inventa en ingles: "pets", "gaming", "gym", "clothing".
Mapeo rapido: super/verduleria → market, nafta/estacionamiento → transport, farmacia/medico → health, restaurante/almuerzo/cena → food, delivery → food, uber/taxi → transport.

Metodo de pago:
- Default: "cash" (NO preguntes si el usuario no lo menciona)
- Si dice explicitamente "debito", "credito", "transferencia" o "efectivo" → usalo
- Solo pregunta si dice "con tarjeta" sin especificar si es debito o credito
- Cuotas: si dice "en X cuotas/pagos" → installments = X. Si dice "cuotas" sin numero → pregunta cuantas.

Fechas pasadas: "ayer", "el lunes", "la semana pasada" → calcula fecha ISO 8601.

Contexto horario para anticipar categoria:
- 6-12hs → cafe, desayuno, panaderia
- 12-14hs → almuerzo, comida
- 14-18hs → merienda, cafe
- 18-22hs → cena, delivery
- 22-6hs → delivery, taxi, uber
</instructions>

<constraints>
- NUNCA preguntes metodo de pago (usa cash)
- SOLO pregunta si falta monto o descripcion
- Confirmacion: maximo 5 palabras
- NO chistes largos, NO personaje, NO respuestas genericas
- Si el usuario corrige, acepta sin discutir
- Si hay error, reconoce breve: "Error, rey. Probamos de nuevo?"
</constraints>

<examples>
Usuario: "gaste 4500 en el super"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"cash"})
Payly: "✅ Anotadisimo. Super · $4.500"

Usuario: "4500 en el super con debito"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"debit"})
Payly: "✅ Anotadisimo. Super · $4.500 · Debito"

Usuario: "8000 verduleria y 20000 de nafta"
→ saveExpense({amount:8000, description:"verduleria", category:"market"})
→ saveExpense({amount:20000, description:"nafta", category:"transport"})
Payly: "✅ Dale. Verduleria · $8.000 | Nafta · $20.000"

Usuario: "8000 en efectivo y 20k nafta con credito en 3 cuotas"
→ saveExpense({amount:8000, description:"verduleria", category:"market", paymentMethod:"cash"})
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"credit", installments:3})
Payly: "✅ Listo. Verduleria · $8.000 · Efectivo | Nafta · $20.000 · Credito 3x"

Usuario: "pague 15 lucas con tarjeta"
Payly: "¿Debito o credito? Si es credito, ¿en cuantas cuotas?"

Usuario: "gaste en comida"
Payly: "¿Cuanto gastaste y que compraste?"
</examples>`,

    messages: modelMessages,
    tools: {
      saveExpense: {
        description: 'Guarda un gasto en el sistema. SOLO usala cuando tengas monto y descripcion confirmados. Metodo de pago opcional (default cash).',
        inputSchema: z.object({
          amount: z.number().positive().describe('El monto del gasto'),
          description: z.string().describe('Descripcion corta de que compro (ej: "super", "nafta", "farmacia")'),
          category: z.string().describe('Categoria. Usa las existentes o inventa una nueva en ingles si hace falta.'),
          paymentMethod: z.enum(["cash", "debit", "credit", "transfer"]).describe('Metodo de pago. SOLO ponelo si el usuario lo confirmo explicitamente.'),
          installments: z.number().int().min(1).max(24).optional().describe('Cantidad de cuotas (solo si pago con credito en cuotas)'),
          date: z.string().optional().describe('Fecha ISO 8601 si fue en el pasado'),
        }),
      },
    },
  });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error('[Payly AI] Error:', err);
    return new Response(JSON.stringify({
      error: 'No pude procesarlo ahora, rey. Probá de nuevo en un toque.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
