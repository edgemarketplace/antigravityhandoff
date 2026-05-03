"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

export function AdminSignInGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      const auth = getFirebaseClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken(true);

      const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `firebase-id-token=${encodeURIComponent(idToken)}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;

      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sign in with Google.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-medium">Sign in required</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Use your Google account to continue to tenant admin. If your email is in SUPER_ADMIN_EMAILS you will have
        super-admin access across tenants.
      </p>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white uppercase disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
