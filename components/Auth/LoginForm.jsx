"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";

export default function LoginForm() {
  const router = useRouter();
  const { isLoading, resetPasswordForEmail, signInWithEmail, signInWithGoogle, signUpWithEmail, updatePassword } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSignIn = mode === "signin";
  const isSignUp = mode === "signup";
  const isRecovery = mode === "recovery";
  const isPasswordUpdate = mode === "password-update";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryType = params.get("type") === "recovery" || hashParams.get("type") === "recovery";
    const hasRecoveryCode = params.has("code") || hashParams.has("access_token");

    if (recoveryType || hasRecoveryCode) {
      setMode("password-update");
    }
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function handleGoogle() {
    setError("");
    setNotice("");
    const result = await signInWithGoogle();

    if (result?.error) {
      setError(formatAuthError(result.error, "google"));
      return;
    }

    if (!result?.redirecting) {
      router.push("/nueva-carga");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isPasswordUpdate && !email.trim()) {
      setError("Ingresa tu email para continuar.");
      return;
    }

    if (!isRecovery && !password) {
      setError("Ingresa tu contrasena.");
      return;
    }

    if ((isSignUp || isPasswordUpdate) && password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if ((isSignUp || isPasswordUpdate) && password !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setError("");
    setNotice("");

    const result = await runAuthAction({
      email,
      password,
      isRecovery,
      isPasswordUpdate,
      isSignUp,
      resetPasswordForEmail,
      signInWithEmail,
      signUpWithEmail,
      updatePassword
    });

    if (result?.error) {
      setError(formatAuthError(result.error, mode));
      return;
    }

    if (isRecovery) {
      setNotice("Te enviamos un email para recuperar tu cuenta.");
      return;
    }

    if (isPasswordUpdate) {
      setNotice("Contrasena actualizada. Ya podes entrar.");
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState({}, "", "/login");
      setMode("signin");
      return;
    }

    if (result?.needsConfirmation) {
      setNotice("Cuenta creada. Revisa tu email para confirmar el acceso.");
      return;
    }

    router.push("/nueva-carga");
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/70">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={isLoading}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#0066ff] text-base font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.28)] transition active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-[#0066ff]">G</span>
        {isLoading ? "Conectando..." : "Continuar con Google"}
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-100" />
        <span className="text-xs font-black uppercase text-slate-400">o</span>
        <span className="h-px flex-1 bg-slate-100" />
      </div>

      {!isPasswordUpdate && (
        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={[
            "h-11 rounded-xl text-sm font-black transition",
            isSignIn ? "bg-white text-slate-950 shadow-sm" : "text-slate-400"
          ].join(" ")}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={[
            "h-11 rounded-xl text-sm font-black transition",
            isSignUp ? "bg-white text-slate-950 shadow-sm" : "text-slate-400"
          ].join(" ")}
        >
          Crear cuenta
        </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {!isPasswordUpdate && (
            <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-slate-400">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-base font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0066ff] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            </label>
          )}

          {!isRecovery && (
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase text-slate-400">Contrasena</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={isSignUp || isPasswordUpdate ? "new-password" : "current-password"}
                placeholder="********"
                className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-base font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0066ff] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
          )}

          {(isSignUp || isPasswordUpdate) && (
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase text-slate-400">Confirmar contrasena</span>
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="********"
                className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-base font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0066ff] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
          )}
        </div>

        {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
        {notice && <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
        >
          {getSubmitLabel({ isLoading, isPasswordUpdate, isRecovery, isSignUp })}
        </button>
      </form>

      {!isPasswordUpdate && (
        <button
          type="button"
          onClick={() => switchMode(isRecovery ? "signin" : "recovery")}
          className="mt-4 flex h-10 w-full items-center justify-center text-sm font-black text-[#0066ff]"
        >
          {isRecovery ? "Volver a iniciar sesion" : "Olvide mi contrasena"}
        </button>
      )}
    </section>
  );
}

async function runAuthAction({
  email,
  password,
  isRecovery,
  isPasswordUpdate,
  isSignUp,
  resetPasswordForEmail,
  signInWithEmail,
  signUpWithEmail,
  updatePassword
}) {
  if (isRecovery) {
    return resetPasswordForEmail(email);
  }

  if (isPasswordUpdate) {
    return updatePassword(password);
  }

  if (isSignUp) {
    return signUpWithEmail({ email, password });
  }

  return signInWithEmail({ email, password });
}

function getSubmitLabel({ isLoading, isPasswordUpdate, isRecovery, isSignUp }) {
  if (isLoading && isPasswordUpdate) {
    return "Actualizando...";
  }

  if (isLoading && isRecovery) {
    return "Enviando...";
  }

  if (isLoading && isSignUp) {
    return "Creando...";
  }

  if (isLoading) {
    return "Entrando...";
  }

  if (isRecovery) {
    return "Enviar recuperacion";
  }

  if (isPasswordUpdate) {
    return "Actualizar contrasena";
  }

  return isSignUp ? "Crear cuenta" : "Entrar";
}

function formatAuthError(error, mode) {
  const fallbackByMode = {
    google: "No se pudo iniciar sesion con Google.",
    "password-update": "No se pudo actualizar la contrasena.",
    recovery: "No se pudo enviar la recuperacion.",
    signin: "No se pudo iniciar sesion.",
    signup: "No se pudo crear la cuenta."
  };
  const message = error?.message || fallbackByMode[mode] || "No se pudo completar la accion.";

  if (error?.status >= 500) {
    return `${message}. Revisa la configuracion de Auth en Supabase.`;
  }

  return message;
}
