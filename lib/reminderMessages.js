export const reminderMessageTones = {
  tranqui: [
    "Che, {nombre}, no te olvides de cargar tus gastos de hoy.",
    "{nombre}, no te cuelgues con los gastos de hoy.",
    "Pasá por Payly un toque y cargá lo de hoy.",
    "Un minutito y dejás tus gastos al día.",
    "Payly pregunta tranqui: ¿hubo gastos hoy?"
  ],
  cercano: [
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

export function pickReminderMessage({ name, tone = "cercano", date = new Date() } = {}) {
  const safeName = name || "che";
  const messages = reminderMessageTones[tone] || reminderMessageTones.tranqui;
  const index = date.getDate() % messages.length;
  return messages[index].replace("{nombre}", safeName);
}
