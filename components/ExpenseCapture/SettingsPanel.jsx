import { useState } from "react";
import { getSyncStatusLabel } from "./Header";

export default function SettingsPanel({
  locationSupported,
  nextReminderTime,
  notificationPermission,
  notificationSupported,
  onClose,
  onClearData,
  onReminderHourChange,
  onToggleLocation,
  onToggleNotifications,
  onToggleSwipeSave,
  onToggleVibration,
  preferences,
  syncStatus
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  function handleClearData() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    onClearData();
    setConfirmClear(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-28 pt-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Configuracion</p>
            <h2 className="text-2xl font-black">Preferencias</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-black text-slate-500 shadow-sm"
            aria-label="Cerrar"
          >
            x
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          <SettingRow label="Moneda" value="ARS" />
          <SettingRow label="Guardado" value={getSyncStatusLabel(syncStatus)} />
          <SettingToggle label="Vibracion al guardar" enabled={preferences.vibrationEnabled} onToggle={onToggleVibration} />
          <SettingToggle label="Swipe para guardar" enabled={preferences.swipeSaveEnabled} onToggle={onToggleSwipeSave} />
          <SettingToggle
            label="Recordatorio diario"
            enabled={preferences.notificationsEnabled}
            disabled={!notificationSupported}
            onToggle={onToggleNotifications}
          />
          <ReminderSettings
            enabled={preferences.notificationsEnabled}
            hour={preferences.reminderHour}
            nextReminderTime={nextReminderTime}
            permission={notificationPermission}
            supported={notificationSupported}
            onHourChange={onReminderHourChange}
          />
          <SettingToggle
            label="Ubicacion al guardar"
            enabled={preferences.locationEnabled}
            disabled={!locationSupported}
            onToggle={onToggleLocation}
          />

          <button
            type="button"
            onClick={handleClearData}
            className={[
              "mt-4 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-black transition active:scale-[0.98]",
              confirmClear ? "bg-red-500 text-white" : "bg-red-50 text-red-600"
            ].join(" ")}
          >
            {confirmClear ? "Tocar otra vez para borrar" : "Borrar datos locales"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ReminderSettings({ enabled, hour, nextReminderTime, permission, supported, onHourChange }) {
  const status = getReminderStatus({ enabled, permission, supported });

  return (
    <section className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">Horario del recordatorio</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{status}</p>
        </div>
        <span className={["rounded-full px-3 py-1 text-xs font-black", enabled ? "bg-blue-50 text-[#0066ff]" : "bg-slate-100 text-slate-400"].join(" ")}>
          {enabled ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        {[20, 21].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onHourChange(option)}
            className={[
              "h-10 rounded-xl text-sm font-black transition active:scale-95",
              hour === option ? "bg-white text-[#0066ff] shadow-sm" : "text-slate-500"
            ].join(" ")}
          >
            {option}:00
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold text-slate-500">
        {nextReminderTime
          ? `Proximo aviso: ${formatReminderDate(nextReminderTime)}`
          : "Se activa si el permiso del navegador esta concedido."}
      </p>
    </section>
  );
}

function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
      <span className="font-black text-slate-950">{label}</span>
      <span className="text-sm font-bold text-slate-400">{value}</span>
    </div>
  );
}

function SettingToggle({ label, enabled, disabled = false, onToggle }) {
  const knob = (
    <span className={["flex h-7 w-12 items-center rounded-full p-1", enabled ? "bg-[#0066ff]" : "bg-slate-200"].join(" ")}>
      <span className={["h-5 w-5 rounded-full bg-white shadow-sm", enabled ? "ml-5" : "ml-0"].join(" ")} />
    </span>
  );

  if (!onToggle) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <span className="font-black text-slate-950">{label}</span>
        {knob}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm transition active:scale-[0.98] disabled:cursor-default disabled:opacity-50"
    >
      <span className="font-black text-slate-950">{label}</span>
      {knob}
    </button>
  );
}

function getReminderStatus({ enabled, permission, supported }) {
  if (!supported) {
    return "Este navegador no soporta notificaciones.";
  }
  if (permission === "denied") {
    return "Permiso bloqueado en el navegador.";
  }
  if (!enabled) {
    return "Tocalo para pedir permiso y activar.";
  }
  if (permission !== "granted") {
    return "Falta conceder permiso de notificaciones.";
  }

  return "Si no cargaste gastos, Payly te avisa a esa hora.";
}

function formatReminderDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
