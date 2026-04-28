function SocialButton({ label, highlighted = false, children, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        "flex h-14 w-14 items-center justify-center rounded-full border text-lg font-black shadow-sm transition active:scale-95",
        highlighted
          ? "border-[#0066ff] bg-blue-50 text-[#0066ff]"
          : "border-slate-100 bg-white text-slate-950"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function SocialButtons({ onGoogle }) {
  return (
    <div className="flex justify-center gap-4">
      <SocialButton label="Ingresar con Google" highlighted onClick={onGoogle}>
        G
      </SocialButton>
      <SocialButton label="Ingresar con Apple">A</SocialButton>
      <SocialButton label="Ingresar con X">X</SocialButton>
    </div>
  );
}
