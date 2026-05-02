export default function NavigationDock({ onCapture, onMenu, isMenuOpen }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40" aria-label="Accesos rapidos">
      <div className="mx-auto flex max-w-md items-center justify-around rounded-t-[2rem] border border-white/70 bg-white/95 px-12 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-14px_45px_rgba(15,23,42,0.10)] backdrop-blur">
        <DockButton label="Carga" onClick={onCapture}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M12 5v14M5 12h14" />
        </DockButton>
        <DockButton label="Menu" onClick={onMenu} primary active={isMenuOpen}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M5 7h14M5 12h14M5 17h14" />
        </DockButton>
      </div>
    </nav>
  );
}

function DockButton({ label, active = false, primary = false, disabled = false, onClick, children }) {
  if (primary) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={[
          "flex h-16 w-16 -translate-y-8 items-center justify-center rounded-full bg-[#0066ff] text-white shadow-[0_18px_34px_rgba(0,102,255,0.35)] transition duration-150 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-35",
          active ? "ring-4 ring-blue-200" : ""
        ].join(" ")}
        aria-label={label}
      >
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          {children}
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition duration-150 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-35",
        active ? "text-[#0066ff]" : "text-slate-400"
      ].join(" ")}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
      <span>{label}</span>
    </button>
  );
}
