import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

export const maxDuration = 10;

const CATEGORY_LABELS = {
  services: 'Servicios', food: 'Comida', health: 'Salud',
  home: 'Hogar', market: 'Super', other: 'Otros', leisure: 'Ocio', transport: 'Transporte'
};

const METHOD_LABELS = {
  cash: 'Efectivo', debit: 'Debito', credit: 'Credito', transfer: 'Transfer'
};

export async function POST(req) {
  const authHeader = req.headers.get('Authorization');
  let userId = null;
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
    userId = user.id;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
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

  let recentContext = '';
  let learnedContext = '';
  let categoriesList = [];
  let paymentMethodsList = [];

  if (userId) {
    try {
      const [expensesRes, catRes, payRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('amount, description, spent_at, categories(key), payment_methods(key)')
          .eq('user_id', userId)
          .order('spent_at', { ascending: false })
          .limit(8),
        supabase.from('categories').select('key'),
        supabase.from('payment_methods').select('key'),
      ]);

      const recent = expensesRes.data || [];
      if (recent.length > 0) {
        const lines = recent.map((e) => {
          const cat = CATEGORY_LABELS[e.categories?.key] || e.categories?.key || '?';
          const method = METHOD_LABELS[e.payment_methods?.key] || e.payment_methods?.key || 'efectivo';
          const dateStr = e.spent_at
            ? new Date(e.spent_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit' })
            : 'hoy';
          return `- $${Number(e.amount).toFixed(0)} en ${e.description} · ${method} · ${cat} · ${dateStr}`;
        });
        recentContext = `\n<recent>\nGastos recientes del usuario (para referencia, no los repitas como si fueran nuevos):\n${lines.join('\n')}\n</recent>`;
      }

      if (catRes.data) categoriesList = catRes.data.map((c) => c.key);
      if (payRes.data) paymentMethodsList = payRes.data.map((p) => p.key);
    } catch (e) {
      console.warn('[Payly AI] Context load warning:', e.message);
    }

    try {
      const { data: parserData } = await supabase
        .from('parser_keywords')
        .select('keyword, count, categories(key)')
        .eq('user_id', userId)
        .order('count', { ascending: false })
        .limit(10);

      if (parserData?.length) {
        const rules = parserData
          .filter((r) => r.keyword && r.categories?.key)
          .map((r) => `- "${r.keyword}" → ${CATEGORY_LABELS[r.categories.key] || r.categories.key} (${r.count}x)`);
        if (rules.length > 0) {
          learnedContext = `\n<learned>\nEl usuario suele categorizar asi (reglas aprendidas):\n${rules.join('\n')}\n</learned>`;
        }
      }
    } catch {
      // parser_keywords table may not exist
    }
  }

  const catList = categoriesList.length ? categoriesList.join(', ') : 'services, food, health, home, market, other, leisure, transport';
  const payList = paymentMethodsList.length ? paymentMethodsList.join(', ') : 'cash, debit, credit, transfer';

  try {
    const result = streamText({
    model: openai('gpt-4o-mini'),
    maxOutputTokens: 256,
    system: `<role>
Sos Payly, el asistente mas piola y buena onda que ayuda con la guita. Argentino, canchero, hablas en lunfardo. Trato neutral: "crack", "genio", "fenomeno", "joya".${userContext}
Hoy: ${today} (${timeContext}).
Buena onda, cero robot. Emojis justos (💸 💳 🛒 ✅). Frases: "De una.", "Joya.", "Dale.", "Tranqui.", "Listorti.", "Anotadisimo."
</role>${recentContext}${learnedContext}
<instructions>
Extrae monto, descripcion, categoria y metodo de pago de cada gasto. Si hay varios gastos, procesalos juntos.

ANTES de llamar a saveExpense, SIEMPRE mostra un resumen claro en espanol y pedi confirmacion con "¿Lo guardo?":
"$4.500 en super · debito · market. ¿Lo guardo?"

Si algun dato fue asumido, avisa cual:
"$4.500 en super · efectivo · market (asumí efectivo). ¿Lo guardo?"

IMPORTANTE sobre la confirmacion: el usuario puede responder con CUALQUIER afirmacion corta. TODAS estas significan que confirma: "si", "sí", "dale", "ok", "okey", "de una", "joya", "guardar", "guardalo", "confirmar", "confirmo", "listo", "listorti", "anotalo", "mandale", "va", "obvio", "sep", "👍", "✅". Cuando el usuario responde con una afirmacion corta, NO intentes extraer un nuevo gasto de esa respuesta. Simplemente llama a saveExpense.

Cuando el usuario confirme, llama a saveExpense con los datos del resumen mostrado.

UNICA excepcion: si el usuario dijo ABSOLUTAMENTE TODO explicito (monto, descripcion, metodo de pago, y menciono "hoy" o "ayer" o una fecha concreta), podes llamar a saveExpense directo, y despues respondes con el resumen de lo guardado.

Mismo flujo para varios gastos: mostra el resumen de todos juntos, pedi confirmacion con "¿Lo guardo?", y cuando confirme llama una vez por cada uno.

Para BORRAR un gasto: el usuario pide eliminar uno. Identifica cual por la descripcion (y monto si dice). Mostra cual vas a borrar y pedi confirmacion:
"¿Borro pizza por $800?"
Cuando confirme, llama a deleteExpense con la descripcion. Si hay varios con la misma descripcion, usa tambien amount.

Para EDITAR un gasto: el usuario pide cambiar algo (metodo de pago, categoria, monto, descripcion). Identifica cual por la descripcion. Mostra el cambio y pedi confirmacion:
"¿Cambio super a debito?"
Cuando confirme, llama a updateExpense con description y changes.

Categorias SOLO estas: ${catList}.
Mapeo: super/verduleria → market, nafta → transport, farmacia/medico → health, restaurante/almuerzo/cena → food, delivery → food, uber/taxi → transport. Si no encaja → "other".

Metodo de pago: default "cash". Si dice debito/credito/transferencia/efectivo → usalo. Si dice "con tarjeta" sin especificar → pregunta debito o credito. Cuotas: "en X cuotas" → installments = X.

Fecha: SIEMPRE asume que fue hoy. NO incluyas el campo date en saveExpense a menos que el usuario haya dicho explicitamente "ayer", "anteayer", "el lunes pasado" o alguna fecha pasada concreta. Si el gasto es de hoy, NO pongas date.
</instructions>

<constraints>
- SIEMPRE mostra resumen y pedi confirmacion con "¿Lo guardo?" (salvo que TODO sea explicito)
- Si asumiste algo, aclara: "(asumí efectivo)" en el resumen
- Acepta CUALQUIER afirmacion corta como confirmacion: "si", "dale", "ok", "de una", "joya", "guardar", "listo", etc.
- Cuando recibis una afirmacion corta, NO intentes extraer un nuevo gasto. Confirma y guarda.
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
Payly: "$4.500 en super · efectivo · market (asumí efectivo). ¿Lo guardo?"
Usuario: "si"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"cash"})
Payly: "✅ Anotadisimo. Super · $4.500"

Usuario: "4500 en el super con debito"
Payly: "$4.500 en super · debito · market. ¿Lo guardo?"
Usuario: "dale"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"debit"})
Payly: "✅ De una. Super · $4.500"

Usuario: "4500 en el super con debito hoy"
→ saveExpense({amount:4500, description:"super", category:"market", paymentMethod:"debit"})
Payly: "✅ De una. Super · $4.500 · Debito"

Usuario: "gaste 8000 verduleria y 20k de nafta"
Payly: "$8.000 en verduleria · cash · market | $20.000 en nafta · cash · transport (asumí efectivo). ¿Lo guardo?"
Usuario: "joya"
→ saveExpense({amount:8000, description:"verduleria", category:"market", paymentMethod:"cash"})
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"cash"})
Payly: "✅ Dale. Verduleria · $8.000 | Nafta · $20.000"

Usuario: "20000 de nafta ayer con debito"
→ saveExpense({amount:20000, description:"nafta", category:"transport", paymentMethod:"debit", date:"2026-06-06"})
Payly: "✅ Listo. Nafta · $20.000 · Debito · Ayer"

Usuario: "pague 15 lucas con tarjeta"
Payly: "¿Debito o credito, genio? Si es credito, ¿en cuantas cuotas?"

Usuario: "gaste en comida"
Payly: "¿Cuanto gastaste y que compraste?"

Usuario: "borra el gasto del super"
Payly: "¿Borro super por $4.500?"
Usuario: "si"
→ deleteExpense({description:"super", amount:4500})
Payly: "✅ Borrado. Super · $4.500"

Usuario: "pasame el super a debito"
Payly: "¿Cambio super a debito?"
Usuario: "dale"
→ updateExpense({description:"super", changes:{paymentMethod:"debit"}})
Payly: "✅ Listo. Super → Debito"
</examples>`,

    messages: modelMessages,
    tools: {
      saveExpense: {
        description: 'Guarda un gasto. SOLO usala despues de que el usuario confirmo con una afirmacion corta ("si", "dale", "ok", "joya", "de una", etc). No la uses para extraer datos de una respuesta que es una afirmacion.',
        inputSchema: z.object({
          amount: z.number().positive().describe('El monto del gasto'),
          description: z.string().describe('Descripcion corta de que compro (ej: "super", "nafta", "farmacia")'),
          category: z.enum(["services", "food", "health", "home", "market", "other", "leisure", "transport"]).describe('Categoria del gasto'),
          paymentMethod: z.enum(["cash", "debit", "credit", "transfer"]).optional().describe('Metodo de pago. Si no se menciona, omitilo (el sistema usa cash).'),
          installments: z.number().int().min(1).max(24).optional().describe('Cantidad de cuotas (solo si pago con credito en cuotas)'),
          date: z.string().optional().describe('Fecha YYYY-MM-DD. SOLO si el usuario dijo "ayer" o una fecha pasada. NUNCA incluir para gastos de hoy, aunque tengas la fecha.'),
        }),
      },
      deleteExpense: {
        description: 'Elimina el ultimo gasto que coincida con la descripcion. USALA SOLO despues de que el usuario confirmo que quiere borrar.',
        inputSchema: z.object({
          description: z.string().describe('Descripcion del gasto a borrar (ej: "super", "nafta")'),
          amount: z.number().positive().optional().describe('Monto exacto para desambiguar si hay varios gastos con la misma descripcion'),
        }),
      },
      updateExpense: {
        description: 'Actualiza el ultimo gasto que coincida con la descripcion. Solo inclui en changes los campos que el usuario quiere cambiar. USALA SOLO despues de confirmacion.',
        inputSchema: z.object({
          description: z.string().describe('Descripcion del gasto a modificar'),
          amount: z.number().positive().optional().describe('Monto exacto para desambiguar'),
          changes: z.object({
            paymentMethod: z.enum(["cash", "debit", "credit", "transfer"]).optional(),
            category: z.enum(["services", "food", "health", "home", "market", "other", "leisure", "transport"]).optional(),
            description: z.string().optional(),
          }).describe('Campos a cambiar. Solo inclui los que el usuario pidio modificar.'),
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
