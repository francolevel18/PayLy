import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import webpush from "npm:web-push";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

const cronWindowMinutes = 30;
const allDayStartHour = 9;
const allDayEndHour = 22;
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
                body: pickReminderMessage({ name: "che", tone: profile.reminder_tone || "tranqui", date: now }),
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

function pickReminderMessage({ name, tone = "tranqui", date = new Date() }: { name?: string; tone?: string; date?: Date } = {}) {
  const safeName = name || "che";
  const messagesByTone: Record<string, string[]> = {
    tranqui: [
      "Che, {nombre}, no te olvides de cargar tus gastos de hoy.",
      "{nombre}, no te cuelgues con los gastos de hoy.",
      "Pasá por Payly un toque y cargá lo de hoy.",
      "Un minutito y dejás tus gastos al día.",
      "Payly pregunta tranqui: ¿hubo gastos hoy?"
    ],
    picante: [
      "Ey {nombre}, después no vale decir 'no sé en qué se fue la plata'.",
      "La billetera pide explicaciones, {nombre}. Cargá tus gastos.",
      "Che {nombre}, ¿registramos lo de hoy antes de que se borre de la memoria?",
      "No hace falta sufrirlo, solo cargarlo.",
      "Dale, {nombre}, dejemos el día ordenado."
    ],
    corto: [
      "Che {nombre}, cargá tus gastos de hoy.",
      "{nombre}, ¿hubo gastos hoy?",
      "Payly: gastos de hoy.",
      "Un toque y dejás Payly al día.",
      "Cargá lo de hoy antes de olvidarte."
    ]
  };
  const messages = messagesByTone[tone] || messagesByTone.tranqui;
  const index = date.getDate() % messages.length;
  return messages[index].replace("{nombre}", safeName);
}
