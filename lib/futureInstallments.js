import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const monthKeyLength = 7;

export async function loadRemoteFutureInstallments(monthsAhead = 6) {
  if (!isSupabaseConfigured) {
    return { rows: [], source: "local" };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) {
    return { rows: [], source: "local" };
  }

  try {
    const { data, error } = await supabase.rpc("get_future_installments", {
      p_months_ahead: monthsAhead
    });

    if (error) {
      throw error;
    }

    return {
      rows: normalizeRemoteInstallments(data),
      source: "remote"
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Cuotas futuras remotas no disponibles.", error?.message || error);
    }
    return { rows: [], source: "local" };
  }
}

export function buildFutureInstallmentSchedule(expenses, { monthsAhead = 6, referenceDate = new Date() } = {}) {
  if (!Array.isArray(expenses) || monthsAhead <= 0) {
    return [];
  }

  const fromMonth = startOfMonth(referenceDate);
  const toMonth = addMonths(fromMonth, monthsAhead - 1);
  const rowsByMonth = new Map();

  for (const expense of expenses) {
    const installments = Math.max(1, Number(expense.installments) || 1);
    if (installments <= 1) {
      continue;
    }

    const paymentMethod = expense.paymentMethod || expense.payment_method;
    const creditCardId = expense.creditCardId || expense.credit_card_id;
    if (paymentMethod !== "credit" && !creditCardId) {
      continue;
    }

    const installmentNumber = normalizeInstallmentNumber(expense.installmentNumber ?? expense.installment_number);
    if (installmentNumber > installments) {
      continue;
    }

    const statementMonth = parseStatementMonth(expense.statementMonth || expense.statement_month || expense.createdAt || expense.spent_at);
    if (!statementMonth) {
      continue;
    }

    const installmentAmount = (Number(expense.amount) || 0) / installments;
    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
      continue;
    }

    for (let quota = installmentNumber; quota <= installments; quota += 1) {
      const month = addMonths(statementMonth, quota - installmentNumber);
      if (month < fromMonth || month > toMonth) {
        continue;
      }

      const key = toMonthKey(month);
      const current = rowsByMonth.get(key) || {
        month: toMonthDate(key),
        committedAmount: 0,
        installmentsCount: 0,
        expenseIds: new Set(),
        creditCardIds: new Set()
      };

      current.committedAmount += installmentAmount;
      current.installmentsCount += 1;
      current.expenseIds.add(expense.id);
      if (creditCardId) {
        current.creditCardIds.add(creditCardId);
      }
      rowsByMonth.set(key, current);
    }
  }

  return [...rowsByMonth.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      month: row.month,
      committedAmount: roundMoney(row.committedAmount),
      installmentsCount: row.installmentsCount,
      expenseIds: [...row.expenseIds],
      creditCardIds: [...row.creditCardIds]
    }));
}

export function summarizeNextMonthInstallments(schedule, monthlyIncome = 0, creditCards = [], referenceDate = new Date()) {
  const nextMonthKey = toMonthKey(addMonths(startOfMonth(referenceDate), 1));
  const row = (schedule || []).find((item) => toMonthKey(item.month) === nextMonthKey);
  const committedAmount = Number(row?.committedAmount) || 0;
  const incomeImpactPercentage = monthlyIncome > 0 ? Math.round((committedAmount / monthlyIncome) * 100) : 0;
  const status = incomeImpactPercentage > 30 ? "critical" : incomeImpactPercentage >= 15 ? "warning" : "normal";
  const cardsById = new Map((creditCards || []).map((card) => [card.id, card]));
  const affectedCards = (row?.creditCardIds || [])
    .map((cardId) => cardsById.get(cardId)?.name)
    .filter(Boolean)
    .slice(0, 2);

  return {
    nextMonth: toMonthDate(nextMonthKey),
    nextMonthInstallmentsTotal: committedAmount,
    installmentsCount: row?.installmentsCount || (committedAmount > 0 ? 1 : 0),
    incomeImpactPercentage,
    status,
    affectedCards
  };
}

function normalizeRemoteInstallments(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      month: toMonthDate(toMonthKey(row.month)),
      committedAmount: roundMoney(Number(row.committed_amount ?? row.committedAmount) || 0)
    }))
    .filter((row) => row.month && row.committedAmount > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
}

function normalizeInstallmentNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) {
    return 1;
  }

  return Math.round(number);
}

function parseStatementMonth(value) {
  const dateOnlyMatch = String(value || "").match(/^(\d{4})-(\d{2})/);
  if (dateOnlyMatch) {
    return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, 1);
  }

  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return startOfMonth(date);
}

function startOfMonth(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(value, months) {
  const date = startOfMonth(value);
  date.setMonth(date.getMonth() + months);
  return date;
}

function toMonthKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  return String(value || "").slice(0, monthKeyLength);
}

function toMonthDate(monthKey) {
  return `${monthKey}-01`;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
