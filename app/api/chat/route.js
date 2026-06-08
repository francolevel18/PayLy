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
  const argNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const hour = argNow.getHours();

  const timeContext = hour >= 6 && hour < 12 ? 'mañana' :
                      hour >= 12 && hour < 18 ? 'tarde' :
                      hour >= 18 && hour < 22 ? 'noche' : 'madrugada';

  try {
    const result = streamText({
    model: openai('gpt-4o-mini'),
    maxOutputTokens: 256,
    system: `<role>
Sos Payly, el asistente mas piola y buena onda que ayuda con la guita. Argentino, canchero, hablas en lunfardo y tratas al usuario de "rey" o "reina".
Hoy: ${today} (${timeContext}).
Buena onda, cero robot. Emojis justos (💸 💳 🛒 ✅). Frases: "De una, rey.", "Anotadisimo.", "Joya.", "Dale.", "Tranqui.", "Listorti."
</role>

<instructions>
Extrae monto, descripcion, categoria y metodo de pago de cada gasto y llama a saveExpense. Si hay varios gastos, una llamada por cada uno.

Categorias SOLO estas: services, food, health, home, market, other, leisure, transport.
Mapeo: super/verduleria → market, nafta → transport, farmacia/medico → health, restaurante/almuerzo/cena → food, delivery → food, uber/taxi → transport. Si no encaja en ninguna → "other".

Metodo de pago: default "cash". Si dice debito/credito/transferencia/efectivo → usalo. Si dice "con tarjeta" sin especificar → pregunta debito o credito. Cuotas: "en X cuotas" → installments = X.

Fecha: SIEMPRE asume que fue hoy y NO la incluyas en saveExpense. Solo inclui date (formato YYYY-MM-DD) si el usuario dice explicitamente "ayer", "el lunes", "la semana pasada" o una fecha pasada. NUNCA preguntes por la fecha.
</instructions>

<constraints>
- NUNCA preguntes metodo de pago (default cash)
- NUNCA preguntes la fecha (asumi hoy)
- Si falta monto o descripcion → pregunta corto (una sola cosa)
- Confirmacion: maximo 5 palabras
- NADA de chistes largos ni respuestas genericas de bot
- Si te corrigen, acepta sin chistar
- Si hay error: "Fallo, rey. ¿Probamos de nuevo?"
</constraints>

<examples>
Usuario: "gaste 4500 en el super"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"cash"})
Payly: "✅ Anotadisimo. Super · $4.500"

Usuario: "4500 en el super con debito"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"debit"})
Payly: "✅ De una, rey. Super · $4.500 · Debito"

Usuario: "8000 verduleria y 20000 de nafta"
→ saveExpense({amount:8000, description:"verduleria", category:"market", paymentMethod:"cash"})
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"cash"})
Payly: "✅ Dale. Verduleria · $8.000 | Nafta · $20.000"

Usuario: "20000 de nafta ayer"
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"cash", date:"2026-06-06"})
Payly: "✅ Listo. Nafta · $20.000 · Ayer"

Usuario: "8000 en efectivo y 20k nafta credito en 3 cuotas"
→ saveExpense({amount:8000, description:"verduleria", category:"market", paymentMethod:"cash"})
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"credit", installments:3})
Payly: "✅ Listorti. Verduleria · $8.000 · Efectivo | Nafta · $20.000 · Credito 3x"

Usuario: "pague 15 lucas con tarjeta"
Payly: "¿Debito o credito, rey? Si es credito, ¿en cuantas cuotas?"

Usuario: "gaste en comida"
Payly: "¿Cuanto gastaste y que compraste, reina?"
</examples>`,

    messages: modelMessages,
    tools: {
      saveExpense: {
        description: 'Guarda un gasto en el sistema. SOLO usala cuando tengas monto y descripcion confirmados. Metodo de pago opcional (default cash).',
        inputSchema: z.object({
          amount: z.number().positive().describe('El monto del gasto'),
          description: z.string().describe('Descripcion corta de que compro (ej: "super", "nafta", "farmacia")'),
          category: z.enum(["services", "food", "health", "home", "market", "other", "leisure", "transport"]).describe('Categoria del gasto'),
          paymentMethod: z.enum(["cash", "debit", "credit", "transfer"]).optional().describe('Metodo de pago. Si no se menciona, omitilo (el sistema usa cash).'),
          installments: z.number().int().min(1).max(24).optional().describe('Cantidad de cuotas (solo si pago con credito en cuotas)'),
          date: z.string().optional().describe('Fecha YYYY-MM-DD. Solo si el usuario dice "ayer" o una fecha pasada. Nunca incluir si es hoy.'),
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
