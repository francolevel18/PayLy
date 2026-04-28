import { categories, formatCurrency } from "./useExpenseParser";

export function buildCategorySummary(expenses) {
  return categories
    .map((category) => ({
      category,
      total: expenses
        .filter((expense) => expense.category === category)
        .reduce((total, expense) => total + expense.amount, 0)
    }))
    .filter((item) => item.total > 0);
}

export function getTopPaymentMethod(expenses) {
  const totals = expenses.reduce((result, expense) => {
    result[expense.paymentMethod] = (result[expense.paymentMethod] || 0) + 1;
    return result;
  }, {});

  return Object.entries(totals).reduce((top, [paymentMethod, count]) => {
    if (!top || count > top.count) {
      return { paymentMethod, count };
    }

    return top;
  }, null);
}

export function getTodayInsight(todayExpenses, topExpense) {
  if (todayExpenses.length === 1) {
    return `Primer gasto del dia: ${formatCurrency(todayExpenses[0].amount)}`;
  }

  return topExpense ? `Mayor gasto: ${topExpense.description} ${formatCurrency(topExpense.amount)}` : "";
}

export function getFirstName(user) {
  const source = user?.user_metadata?.name || user?.email || "";
  const first = source.split("@")[0].split(/[ ._-]/).filter(Boolean)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "che";
}
