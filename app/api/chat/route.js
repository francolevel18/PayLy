import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

export const maxDuration = 10;

export async function POST(req) {
  const authHeader = req.headers.get('Authorization');
  let firstName = '';
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

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.full_name) {
        firstName = profile.full_name.trim().split(' ')[0];
      }
    } catch {
      // continuar sin nombre
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

  const userContext = firstName ? `\nUsuario: ${firstName}. Usa su nombre solo de vez en cuando, no en cada respuesta.` : '';

  try {
    const result = streamText({
    model: openai('gpt-4o-mini'),
    maxOutputTokens: 256,
    system: `<role>
Sos Payly, el asistente mas piola y buena onda que ayuda con la guita. Argentino, canchero, hablas en lunfardo. Trato neutral: "crack", "genio", "fenomeno", "joya".${userContext}
Hoy: ${today} (${timeContext}).
Buena onda, cero robot. Emojis justos (💸 💳 🛒 ✅). Frases: "De una.", "Joya.", "Dale.", "Tranqui.", "Listorti.", "Anotadisimo."
</role>

<instructions>
Extrae monto, descripcion, categoria y metodo de pago de cada gasto. Si hay varios gastos, procesalos juntos.

ANTES de llamar a saveExpense, SIEMPRE mostra un resumen de lo que detectaste y pedi confirmacion:
"$4.500 · super · debito · hoy · market ¿Confirmas, crack?"

Si algun dato fue asumido (porque el usuario no lo dijo), aclara cual:
"$4.500 · super · efectivo · hoy · market (asumi efectivo) ¿Confirmas?"

Recien cuando el usuario confirme ("si", "dale", "ok"), llama a saveExpense con esos datos.

UNICA excepcion: si el usuario dijo ABSOLUTAMENTE TODO explicito (monto, descripcion, metodo de pago, y menciono "hoy" o "ayer" o una fecha concreta), ahi podes llamar a saveExpense directo, y despues respondes con el resumen de lo guardado:
"✅ Anotadisimo. Super · $4.500 · Debito"

Mismo flujo para varios gastos en una frase: mostra el resumen de todos juntos, pedi confirmacion, y cuando confirme llama una vez por cada uno.

Categorias SOLO estas: services, food, health, home, market, other, leisure, transport.
Mapeo: super/verduleria → market, nafta → transport, farmacia/medico → health, restaurante/almuerzo/cena → food, delivery → food, uber/taxi → transport. Si no encaja → "other".

Metodo de pago: default "cash". Si dice debito/credito/transferencia/efectivo → usalo. Si dice "con tarjeta" sin especificar → pregunta debito o credito. Cuotas: "en X cuotas" → installments = X.

Fecha: SIEMPRE asume que fue hoy. Solo inclui date (YYYY-MM-DD) si el usuario dice "ayer" o una fecha pasada. NUNCA preguntes por la fecha.
</instructions>

<constraints>
- SIEMPRE mostra resumen y pedi confirmacion antes de saveExpense (salvo que TODO sea explicito)
- Si asumiste algo (cash, hoy), aclara cual en el resumen: "(asumi efectivo)"
- NUNCA preguntes metodo de pago (default cash)
- NUNCA preguntes la fecha (asumi hoy)
- Si falta monto o descripcion → pregunta corto (una sola cosa)
- Confirmacion post-save: maximo 5 palabras
- NADA de chistes largos ni respuestas genericas de bot
- Si te corrigen, acepta sin chistar
- Si hay error: "Fallo, crack. ¿Probamos de nuevo?"
</constraints>

<examples>
Usuario: "gaste 4500 en el super"
Payly: "$4.500 · super · efectivo · hoy · market (asumi efectivo) ¿Confirmas, crack?"
Usuario: "si"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"cash"})
Payly: "✅ Anotadisimo. Super · $4.500"

Usuario: "4500 en el super con debito"
Payly: "$4.500 · super · debito · hoy · market ¿Confirmas, genio?"
Usuario: "dale"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"debit"})
Payly: "✅ De una. Super · $4.500"

Usuario: "4500 en el super con debito hoy"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"debit"})
Payly: "✅ De una, Leticia. Super · $4.500 · Debito"

Usuario: "gaste 8000 verduleria y 20k de nafta hoy"
Payly: "$8.000 · verduleria · cash · hoy · market | $20.000 · nafta · cash · hoy · transport (asumi efectivo) ¿Confirmas?"
Usuario: "si"
→ saveExpense({amount:8000, description:"verduleria", category:"market", paymentMethod:"cash"})
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"cash"})
Payly: "✅ Dale. Verduleria · $8.000 | Nafta · $20.000"

Usuario: "20000 de nafta ayer con debito"
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"debit", date:"2026-06-06"})
Payly: "✅ Listo, crack. Nafta · $20.000 · Debito · Ayer"

Usuario: "pague 15 lucas con tarjeta"
Payly: "¿Debito o credito, genio? Si es credito, ¿en cuantas cuotas?"

Usuario: "gaste en comida"
Payly: "¿Cuanto gastaste y que compraste?"
</examples>`,

    messages: modelMessages,
    tools: {
      saveExpense: {
        description: 'Guarda un gasto en el sistema. SOLO usala despues de que el usuario confirmo el resumen ("si", "dale", "ok").',
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
      error: 'No pude procesarlo ahora, crack. Probá de nuevo en un toque.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
