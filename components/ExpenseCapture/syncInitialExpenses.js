import { loadRemoteExpenses, migrateLocalExpenses } from "../../lib/expensesRepository";
import { hasMigratedExpenses, markExpensesMigrated, saveExpenses } from "../../lib/expensesStorage";

export async function syncInitialExpenses(localExpenses, userId) {
  const remoteExpenses = await loadRemoteExpenses();
  if (remoteExpenses.length > 0) {
    saveExpenses(remoteExpenses);
    markExpensesMigrated(userId);
    return remoteExpenses;
  }

  if (!hasMigratedExpenses(userId)) {
    await migrateLocalExpenses(localExpenses);
    markExpensesMigrated(userId);
  }

  return null;
}
