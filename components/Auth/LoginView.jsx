"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "./LoginForm";
import { useAuth } from "../../hooks/useAuth";

export default function LoginView() {
  const router = useRouter();
  const { isSessionLoading, user } = useAuth();
  const isRecoveryRoute = isPasswordRecoveryRoute();

  useEffect(() => {
    if (!isSessionLoading && user && !isRecoveryRoute) {
      router.replace("/nueva-carga");
    }
  }, [isRecoveryRoute, isSessionLoading, router, user]);

  if (isSessionLoading || (user && !isRecoveryRoute)) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-8 text-center text-slate-950">
        <img src="/logo-horizontal-512.png" alt="" className="mb-4 h-16 w-auto" />
        <p className="text-sm font-black text-[#0066ff]"></p>
        <p className="mt-2 text-sm font-semibold text-slate-500">Preparando tu cuenta...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8 text-slate-950">
      <header className="mb-8 text-center">
        <img src="/logo-horizontal-512.png" alt="Payly" className="mx-auto mb-3 h-16 w-auto" />
        <p className="text-sm font-black text-[#0066ff]"></p>
        <h1 className="mt-2 text-3xl font-black">Bienvenido</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">Ingresa o crea tu cuenta para sincronizar tus gastos</p>
      </header>
      <LoginForm />
    </main>
  );
}

function isPasswordRecoveryRoute() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return params.get("type") === "recovery" || hashParams.get("type") === "recovery" || params.has("code");
}
