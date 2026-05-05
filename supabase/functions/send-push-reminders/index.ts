import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import webpush from "npm:web-push";
import { createClient } from "npm:@supabase/supabase-js";

type PushRadarStatus = "normal" | "warning" | "critical";
type ReminderTone = "tranqui" | "picante" | "corto";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

const cronWindowMinutes = 30;
const allDayStartHour = 9;
const allDayEndHour = 22;
const PUSH_MESSAGES: Record<PushRadarStatus, Record<ReminderTone, string[]>> = {
  normal: {
    tranqui: [
      "Vas bien este mes. Si cargaste algo hoy, registralo y seguimos teniendo el panorama claro.",
      "Tu mes viene ordenado. Suma los gastos de hoy para mantener el Radar actualizado."
    ],
    picante: [
      "Todo tranqui por ahora. No te confies: carga lo de hoy y mantene el control.",
      "El Radar viene bien. No lo arruinemos con gastos fantasma."
    ],
    corto: [
      "Vas bien. Carga tus gastos de hoy.",
      "Mes controlado. Actualiza Payly."
    ]
  },
  warning: {
    tranqui: [
      "Venis cerca del limite del mes. Carga tus gastos de hoy y revisamos como seguir.",
      "El Radar marca atencion. Todavia estas a tiempo de ordenar el cierre del mes."
    ],
    picante: [
      "Ojo, el mes viene apretado. Carga lo de hoy antes de que el Radar se ponga rojo.",
      "Estas jugando cerca del limite. Payly necesita los gastos de hoy."
    ],
    corto: [
      "Atencion: venis cerca del limite.",
      "Radar en warning. Revisa tus gastos."
    ]
  },
  critical: {
    tranqui: [
      "El Radar esta en critico. Conviene revisar tus gastos antes de seguir acumulando compromisos.",
      "Estas por encima del margen esperado. Entra a Payly y revisemos el mes con calma."
    ],
    picante: [
      "Radar en rojo. Si seguis asi, el mes se complica. Entra a Payly.",
      "Alerta real: tus gastos vienen pasados. Revisa Payly antes de gastar mas."
    ],
    corto: [
      "Radar critico. Revisa Payly.",
      "Alerta: gastos por encima del margen."
    ]
  }
};
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("APP_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@payly.app";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
  console.error("Missing push reminder env", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasVapidPublicKey: Boolean(vapidPublicKey),
    hasVapidPrivateKey: Boolean(vapidPrivateKey)
  });
}

const supabase = createClient(supabaseUrl!, serviceRoleKey!);
webpush.setVapidDetails(vapidSubject, vapidPublicKey!, vapidPrivateKey!);

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Usa POST para ejecutar send-push-reminders." }, { headers: corsHeaders, status: 405 });
    }

    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
      return Response.json({ ok: false, error: "Unauthorized cron request." }, { headers: corsHeaders, status: 401 });
    }

    const now = new Date();
    const { data: profiles, error } = await supabase
      .from("user_profiles")
      .select("id, user_id, reminder_enabled, reminder_mode, reminder_time, reminder_timezone, reminder_tone, last_reminder_sent_at")
      .eq("reminder_enabled", true);

    if (error) {
      throw error;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const profile of profiles || []) {
      try {
        const timezone = profile.reminder_timezone || "America/Argentina/Buenos_Aires";
        if (!shouldSendReminder(profile, now, timezone)) {
          skipped += 1;
          continue;
        }

        if (await hasExpensesToday(profile.user_id, timezone, now)) {
          skipped += 1;
          continue;
        }

        const subscriptions = await loadActiveSubscriptions(profile.user_id);
        if (subscriptions.length === 0) {
          skipped += 1;
          continue;
        }

        const radarStatus = await loadPushRadarStatus(profile.user_id);
        const messageBody = pickPushMessage(radarStatus, profile.reminder_tone);
        let sentForUser = 0;
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              },
              JSON.stringify({
                title: "Payly",
                body: messageBody,
                tag: "payly-daily-expense-reminder",
                url: "/nueva-carga"
              })
            );
            sentForUser += 1;
          } catch (pushError: any) {
            failed += 1;
            if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
              await supabase.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
            }
            console.error("Push error:", {
              user_id: profile.user_id,
              statusCode: pushError?.statusCode,
              message: pushError?.message
            });
          }
        }

        if (sentForUser > 0) {
          sent += sentForUser;
          await supabase
            .from("user_profiles")
            .update({ last_reminder_sent_at: now.toISOString(), updated_at: now.toISOString() })
            .eq("id", profile.id);
        }
      } catch (userError: any) {
        failed += 1;
        console.error("Reminder user error:", {
          user_id: profile.user_id,
          message: userError?.message
        });
      }
    }

    return Response.json(
      {
        ok: true,
        sent,
        skipped,
        failed,
        total_profiles: profiles?.length || 0
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Function error:", err);
    return Response.json({ ok: false, error: err?.message || "Unknown error" }, { headers: corsHeaders, status: 500 });
  }
});

async function loadActiveSubscriptions(userId: string) {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return (data || []).filter((subscription) => subscription.endpoint && subscription.p256dh && subscription.auth);
}

async function hasExpensesToday(userId: string, timezone: string, now: Date) {
  const { startUtc, endUtc } = getZonedDayRange(timezone, now);
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("spent_at", startUtc.toISOString())
    .lt("spent_at", endUtc.toISOString());

  if (error) {
    throw error;
  }

  return (count || 0) > 0;
}

async function loadPushRadarStatus(userId: string): Promise<PushRadarStatus> {
  try {
    const { data, error } = await supabase.rpc("get_push_radar_state_for_user", {
      p_user_id: userId
    });

    if (error) {
      throw error;
    }

    return normalizePushRadarStatus(data?.status);
  } catch (error: any) {
    console.warn("Push radar fallback:", {
      user_id: userId,
      message: error?.message || error
    });
    return "normal";
  }
}

function shouldSendReminder(profile: any, now: Date, timezone: string) {
  if (wasReminderSentToday(profile.last_reminder_sent_at, timezone, now)) {
    return false;
  }

  const local = getZonedParts(now, timezone);
  if (profile.reminder_mode === "all_day") {
    return local.hour >= allDayStartHour && local.hour < allDayEndHour;
  }

  const reminderMinutes = parseReminderMinutes(profile.reminder_time || "20:00");
  const nowMinutes = local.hour * 60 + local.minute;
  return nowMinutes >= reminderMinutes && nowMinutes < reminderMinutes + cronWindowMinutes;
}

function wasReminderSentToday(value: string | null, timezone: string, now: Date) {
  if (!value) {
    return false;
  }

  return getZonedDateKey(new Date(value), timezone) === getZonedDateKey(now, timezone);
}

function getZonedDayRange(timezone: string, now: Date) {
  const parts = getZonedParts(now, timezone);
  const startUtc = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, timezone);
  const endUtc = zonedTimeToUtc(parts.year, parts.month, parts.day + 1, 0, 0, timezone);
  return { startUtc, endUtc };
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimezoneOffsetMs(utcGuess, timezone);
  return new Date(utcGuess.getTime() - offset);
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function getZonedDateKey(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getZonedParts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric"
  }).formatToParts(date);

  const map = Object.fromEntries(values.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) === 24 ? 0 : Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function parseReminderMinutes(value: string) {
  const [hours, minutes] = String(value || "20:00").split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 20) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function pickPushMessage(status: string = "normal", tone: string = "tranqui") {
  const safeStatus = normalizePushRadarStatus(status);
  const safeTone = normalizeReminderTone(tone);
  const options = PUSH_MESSAGES[safeStatus][safeTone] || PUSH_MESSAGES.normal.tranqui;

  return options[Math.floor(Math.random() * options.length)] || PUSH_MESSAGES.normal.tranqui[0];
}

function normalizePushRadarStatus(status: string | null | undefined): PushRadarStatus {
  return status === "warning" || status === "critical" ? status : "normal";
}

function normalizeReminderTone(tone: string | null | undefined): ReminderTone {
  return tone === "picante" || tone === "corto" ? tone : "tranqui";
}
