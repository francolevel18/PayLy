import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsSessionLoading(false);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setUser(data.session?.user ?? null);
        setIsSessionLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsSessionLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/nueva-carga`
        }
      });
      setIsLoading(false);
      return { ok: !error, error, redirecting: !error };
    }

    const nextUser = { id: "local-google", provider: "google", email: "google@payly.local" };
    setUser(nextUser);
    setIsLoading(false);
    return { ok: true, user: nextUser };
  }

  async function signInWithEmail({ email, password }) {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      const { data, error } = password
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/nueva-carga`
            }
          });
      if (data?.user) {
        setUser(data.user);
      }
      setIsLoading(false);
      return { ok: !error, user: data?.user ?? null, error };
    }

    const nextUser = { id: "local-email", provider: "email", email };
    setUser(nextUser);
    setIsLoading(false);
    return { ok: true, user: nextUser };
  }

  async function signUpWithEmail({ email, password }) {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/nueva-carga`,
          data: {
            email,
            full_name: email.split("@")[0]
          }
        }
      });

      if (data?.session?.user) {
        setUser(data.session.user);
      }

      setIsLoading(false);
      return {
        ok: !error,
        user: data?.user ?? null,
        error,
        needsConfirmation: Boolean(data?.user && !data?.session)
      };
    }

    const nextUser = { id: "local-signup", provider: "email", email };
    setUser(nextUser);
    setIsLoading(false);
    return { ok: true, user: nextUser, needsConfirmation: false };
  }

  async function resetPasswordForEmail(email) {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`
      });
      setIsLoading(false);
      return { ok: !error, error };
    }

    setIsLoading(false);
    return { ok: true };
  }

  async function updatePassword(password) {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (data?.user) {
        setUser(data.user);
      }
      setIsLoading(false);
      return { ok: !error, user: data?.user ?? null, error };
    }

    setIsLoading(false);
    return { ok: true };
  }

  async function signOut() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }

    setUser(null);
    return { ok: true };
  }

  return {
    isLoading,
    isSessionLoading,
    signInWithEmail,
    signInWithGoogle,
    resetPasswordForEmail,
    signUpWithEmail,
    signOut,
    updatePassword,
    user
  };
}
