export function computeFinancialRadarState({
  currentSpent = 0,
  monthlyBudget = 0,
  monthlyIncome = 0,
  nextMonthInstallments = 0,
  projectedTotal = 0
} = {}) {
  const spent = Math.max(0, Number(currentSpent) || 0);
  const budget = Math.max(0, Number(monthlyBudget) || 0);
  const income = Math.max(0, Number(monthlyIncome) || 0);
  const installments = Math.max(0, Number(nextMonthInstallments) || 0);
  const projected = Math.max(spent, Number(projectedTotal) || 0);
  const referenceAmount = budget > 0 ? budget : income;
  const referenceKind = budget > 0 ? "budget" : income > 0 ? "income" : "none";
  const currentRatio = getRatio(spent, referenceAmount);
  const projectedRatio = getRatio(projected, referenceAmount);
  const installmentRatio = getRatio(installments, income || referenceAmount);
  const pressureAmount = projected + installments;
  const pressureRatio = getRatio(pressureAmount, referenceAmount);

  if (referenceKind === "none") {
    return {
      action: "Configura ingreso o presupuestos para una lectura mas precisa.",
      currentRatio,
      installmentRatio,
      label: "Radar financiero",
      message: "Payly ya puede leer tu ritmo, pero le falta una referencia mensual.",
      pressureAmount,
      pressureRatio,
      projectedRatio,
      referenceAmount,
      referenceKind,
      referenceLabel: "Sin referencia",
      status: "normal"
    };
  }

  const status = getStatus({ currentRatio, installmentRatio, pressureRatio, projectedRatio });
  const copy = getStatusCopy(status, {
    hasBudget: budget > 0,
    hasIncome: income > 0,
    installments,
    pressureRatio,
    projectedRatio
  });

  return {
    ...copy,
    currentRatio,
    installmentRatio,
    pressureAmount,
    pressureRatio,
    projectedRatio,
    referenceAmount,
    referenceKind,
    referenceLabel: referenceKind === "budget" ? "Presupuesto mensual" : "Ingreso mensual",
    status
  };
}

function getStatus({ currentRatio, installmentRatio, pressureRatio, projectedRatio }) {
  if (projectedRatio >= 1 || pressureRatio >= 1.08 || currentRatio >= 0.9 || installmentRatio >= 0.3) {
    return "critical";
  }

  if (projectedRatio >= 0.82 || pressureRatio >= 0.9 || currentRatio >= 0.65 || installmentRatio >= 0.15) {
    return "warning";
  }

  return "normal";
}

function getStatusCopy(status, { hasBudget, hasIncome, installments, pressureRatio, projectedRatio }) {
  if (status === "critical") {
    return {
      action: installments > 0 ? "Revisa gastos variables antes de sumar otra cuota." : "Baja el ritmo de gasto esta semana.",
      label: "Alto riesgo",
      message:
        pressureRatio >= 1.08
          ? "La proyeccion mas las cuotas proximas dejan poco margen."
          : "Si seguis a este ritmo, el mes queda por encima de tu referencia."
    };
  }

  if (status === "warning") {
    return {
      action: installments > 0 ? "Cuidar compras nuevas en cuotas te da aire." : "Conviene mirar la categoria que mas pesa.",
      label: "Atencion",
      message:
        projectedRatio >= 0.82
          ? "La proyeccion se esta acercando a tu referencia mensual."
          : "El mes viene bien, pero ya hay compromisos para el proximo resumen."
    };
  }

  return {
    action: hasIncome || hasBudget ? "Mantenete cerca de este ritmo." : "Agrega una referencia para afinar el Radar.",
    label: "Vas bien",
    message: installments > 0 ? "Tu ritmo actual esta controlado y las cuotas proximas son manejables." : "Tu ritmo actual esta dentro de la referencia."
  };
}

function getRatio(value, reference) {
  if (!reference) {
    return 0;
  }

  return Math.max(0, value / reference);
}
