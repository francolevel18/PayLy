import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const insightTypes = new Set([
  "top_category",
  "budget_pace",
  "future_installments_pressure",
  "payment_method_dominance"
]);

const severities = new Set(["info", "warning"]);

export async function loadRemoteAutoInsights() {
  if (!isSupabaseConfigured) {
    return { insights: [], source: "local" };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) {
    return { insights: [], source: "local" };
  }

  try {
    const { data, error } = await supabase.rpc("get_auto_insights");

    if (error) {
      throw error;
    }

    return {
      insights: normalizeAutoInsights(data),
      source: "remote"
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Auto insights remotos no disponibles.", error?.message || error);
    }
    return { insights: [], source: "local" };
  }
}

export function normalizeAutoInsights(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const message = normalizeText(row?.message);
      if (!message) {
        return null;
      }

      const title = normalizeText(row?.title);
      const type = insightTypes.has(row?.type) ? row.type : "top_category";
      const severity = severities.has(row?.severity) ? row.severity : "info";

      return {
        ...row,
        type,
        severity,
        title,
        message
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

export function formatAutoInsight(insight) {
  const message = normalizeText(insight?.message);
  if (!message) {
    return "";
  }

  const title = normalizeText(insight?.title);
  if (!title || message.toLowerCase().startsWith(title.toLowerCase())) {
    return message;
  }

  return `${title}: ${message}`;
}

function normalizeText(value) {
  return String(value || "").trim();
}
