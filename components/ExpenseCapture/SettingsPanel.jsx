import { useState } from "react";
import { getSyncStatusLabel } from "./Header";

export default function SettingsPanel({
  locationSupported,
  nextReminderTime,
  notificationPermission,
  notificationSupported,
  onClose,
  onClearData,
  onReminderModeChange,
  onReminderTimeChange,
  onTestNotification,
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
      <section className="payly-full-panel mx-auto flex w-full max-w-md flex-col px-4 pt-4">
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

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
            mode={preferences.reminderMode}
            nextReminderTime={nextReminderTime}
            permission={notificationPermission}
            supported={notificationSupported}
            onModeChange={onReminderModeChange}
            onTest={onTestNotification}
            onTimeChange={onReminderTimeChange}
            time={preferences.reminderTime}
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

function ReminderSettings({ enabled, hour, mode = "scheduled", nextReminderTime, permission, supported, onModeChange, onTest, onTimeChange, time }) {
  const status = getReminderStatus({ enabled, mode, permission, supported });
  const reminderTime = time || `${String(hour || 20).padStart(2, "0")}:00`;
  const canTest = enabled && permission === "granted" && typeof onTest === "function";

  return (
    <section className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">Recordatorio de carga</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{status}</p>
        </div>
        <span className={["rounded-full px-3 py-1 text-xs font-black", enabled ? "bg-blue-50 text-[#0066ff]" : "bg-slate-100 text-slate-400"].join(" ")}>
          {enabled ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        {[
          { key: "allDay", label: "Todo el dia" },
          { key: "scheduled", label: "Horario" }
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onModeChange(option.key)}
            className={[
              "h-10 rounded-xl text-sm font-black transition active:scale-95",
              mode === option.key ? "bg-white text-[#0066ff] shadow-sm" : "text-slate-500"
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "scheduled" ? (
        <label className="mt-3 block">
          <span className="mb-2 block text-xs font-black uppercase text-slate-400">Hora exacta</span>
          <input
            type="time"
            value={reminderTime}
            onChange={(event) => onTimeChange(event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-black text-slate-950 outline-none focus:border-[#0066ff]"
          />
        </label>
      ) : (
        <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          En este modo se chequea cada pocas horas entre la mañana y la noche.
        </p>
      )}

      <p className="mt-3 text-xs font-bold text-slate-500">
        {nextReminderTime
          ? `Proximo aviso: ${formatReminderDate(nextReminderTime)}`
          : "Se activa si el permiso del navegador esta concedido."}
      </p>

      {canTest ? (
        <button
          type="button"
          onClick={onTest}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-[#0066ff] transition duration-150 ease-out active:scale-[0.98]"
        >
          Probar notificacion
        </button>
      ) : null}
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
    <span className={["flex h-7 w-12 items-center rounded-full p-1 transition-colors duration-150 ease-out", enabled ? "bg-[#0066ff]" : "bg-slate-200"].join(" ")}>
      <span className={["h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out", enabled ? "translate-x-5" : "translate-x-0"].join(" ")} />
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
      className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm transition duration-150 ease-out active:scale-[0.98] disabled:cursor-default disabled:opacity-50"
    >
      <span className="font-black text-slate-950">{label}</span>
      {knob}
    </button>
  );
}

function getReminderStatus({ enabled, mode, permission, supported }) {
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

  if (mode === "allDay") {
    return "Payly revisa durante el dia y avisa si no cargaste gastos.";
  }

  return "Si no cargaste gastos, Payly te avisa en el horario elegido.";
}

function formatReminderDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
