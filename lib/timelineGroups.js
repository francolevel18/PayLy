export function groupByHour(expenses) {
  return buildGroups(filterToday(expenses), (expense) => {
    const date = new Date(expense.createdAt);
    return {
      key: date.toISOString().slice(0, 13),
      label: `${String(date.getHours()).padStart(2, "0")}:00`
    };
  });
}

export function groupByDay(expenses) {
  return buildGroups(filterToday(expenses), (expense) => {
    const date = new Date(expense.createdAt);
    return {
      key: date.toISOString().slice(0, 10),
      label: "Hoy"
    };
  });
}

export function groupByMonth(expenses) {
  const now = new Date();
  const monthExpenses = expenses.filter((expense) => {
    const date = new Date(expense.createdAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });

  return buildGroups(monthExpenses, (expense) => {
    const date = new Date(expense.createdAt);
    return {
      key: date.toISOString().slice(0, 10),
      label: formatShortDate(date)
    };
  }).map((group) => ({ ...group, expenses: [] }));
}

function buildGroups(expenses, getGroup) {
  const groups = new Map();
  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  for (const expense of sortedExpenses) {
    const groupInfo = getGroup(expense);
    const group = groups.get(groupInfo.key) || {
      key: groupInfo.key,
      label: groupInfo.label,
      total: 0,
      count: 0,
      expenses: []
    };

    group.total += expense.amount;
    group.count += 1;
    group.expenses.push(expense);
    groups.set(groupInfo.key, group);
  }

  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function filterToday(expenses) {
  const today = new Date();

  return expenses.filter((expense) => {
    const date = new Date(expense.createdAt);
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  });
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}
