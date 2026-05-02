import { loadRemoteExpenses, migrateLocalExpenses } from "../../lib/expensesRepository";
import { hasMigratedExpenses, markExpensesMigrated, saveExpenses } from "../../lib/expensesStorage";

export async function syncInitialExpenses(localExpenses, userId) {
  const remoteExpenses = await loadRemoteExpenses();
  const pendingLocalExpenses = localExpenses.filter((expense) => ["pending", "error", "local"].includes(expense.syncState));
  if (remoteExpenses.length > 0) {
    const mergedExpenses = mergeRemoteAndPending(remoteExpenses, pendingLocalExpenses);
    saveExpenses(mergedExpenses);
    markExpensesMigrated(userId);
    return {
      expenses: mergedExpenses,
      metrics: {
        pendingCount: pendingLocalExpenses.length,
        remoteCount: remoteExpenses.length
      }
    };
  }

  if (!hasMigratedExpenses(userId)) {
    await migrateLocalExpenses(localExpenses);
    const syncedExpenses = localExpenses.map((expense) => ({
      ...expense,
      syncState: "synced",
      lastSyncError: "",
      syncedAt: new Date().toISOString()
    }));
    saveExpenses(syncedExpenses);
    markExpensesMigrated(userId);
    return {
      expenses: syncedExpenses,
      metrics: {
        pendingCount: 0,
        remoteCount: syncedExpenses.length
      }
    };
  }

  return {
    expenses: null,
    metrics: {
      pendingCount: pendingLocalExpenses.length,
      remoteCount: remoteExpenses.length
    }
  };
}

function mergeRemoteAndPending(remoteExpenses, pendingLocalExpenses) {
  const remoteIds = new Set(remoteExpenses.map((expense) => expense.id));
  const uniquePending = pendingLocalExpenses.filter((expense) => !remoteIds.has(expense.id));
  return [...remoteExpenses, ...uniquePending].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
