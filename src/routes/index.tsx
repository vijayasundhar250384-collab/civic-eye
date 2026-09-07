import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/civic";
import { biometricUnlock, hasBiometricEnrolment } from "@/lib/biometrics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicLens — Verified civic issue reporting" },
      {
        name: "description",
        content:
          "Capture, AI-verify and track civic problems like potholes, drainage and street lights, with automatic escalation to the corporation.",
      },
      { property: "og:title", content: "CivicLens — Verified civic issue reporting" },
      {
        property: "og:description",
        content:
          "AI-verified civic reports with geotagged photos, 3D location view and automatic escalation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [ward, setWard] = useState("Ward 07");
  const [busy, setBusy] = useState(false);
  const [bioReady, setBioReady] = useState(false);

  useEffect(() => {
    setBioReady(hasBiometricEnrolment());
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || password.length < 6) {
      toast.error("Enter a username and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const email = usernameToEmail(username);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username.trim().toLowerCase(), full_name: fullName, ward },
          },
        });
        if (error) throw error;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setBusy(true);
    try {
      const ok = await biometricUnlock();
      if (!ok) throw new Error("Biometric check was cancelled.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Session expired — sign in with your password once.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Biometric unlock failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[430px] space-y-3 px-3 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-brand text-[13px] font-extrabold text-brand-foreground">
            CV
          </span>
          <div className="leading-tight">
            <h1 className="text-[17px] font-extrabold tracking-tight text-ink">CivicLens</h1>
            <p className="text-[11px] font-medium text-muted-foreground">
              Verified civic reporting · urban &amp; rural
            </p>
          </div>
        </div>

        <section className="tile space-y-2.5 p-4">
          <div className="flex items-center justify-between">
            <p className="label-cap">{mode === "signin" ? "Sign in" : "Create account"}</p>
            <span className="font-mono text-[9px] font-semibold text-brand">STEP 1</span>
          </div>

          <form onSubmit={submit} className="space-y-1.5">
            <label className="block rounded-lg bg-frost/70 px-2.5 py-2 ring-1 ring-border">
              <span className="text-[9px] font-medium text-muted-foreground">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="a.verma_07"
                className="w-full bg-transparent text-[13px] font-semibold text-ink outline-none"
              />
            </label>
            <label className="block rounded-lg bg-frost/70 px-2.5 py-2 ring-1 ring-border">
              <span className="text-[9px] font-medium text-muted-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                className="w-full bg-transparent text-[13px] font-semibold tracking-widest text-ink outline-none"
              />
            </label>

            {mode === "signup" && (
              <>
                <label className="block rounded-lg bg-frost/70 px-2.5 py-2 ring-1 ring-border">
                  <span className="text-[9px] font-medium text-muted-foreground">Full name</span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Arun Verma"
                    className="w-full bg-transparent text-[13px] font-semibold text-ink outline-none"
                  />
                </label>
                <label className="block rounded-lg bg-frost/70 px-2.5 py-2 ring-1 ring-border">
                  <span className="text-[9px] font-medium text-muted-foreground">
                    Ward / block
                  </span>
                  <input
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full bg-transparent text-[13px] font-semibold text-ink outline-none"
                  />
                </label>
              </>
            )}

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand py-2.5 text-[12px] font-semibold text-brand-foreground disabled:opacity-60"
              >
                {mode === "signin" ? "Continue" : "Create account"}
              </button>
              <button
                type="button"
                onClick={unlock}
                disabled={busy || !bioReady}
                className="flex items-center justify-center gap-1 rounded-lg bg-frost py-2.5 text-[12px] font-semibold text-ink ring-1 ring-border disabled:opacity-45"
              >
                <span className="block size-3 rounded-full ring-1 ring-brand/40" />
                Fingerprint
              </button>
            </div>
          </form>

          {!bioReady && (
            <p className="text-[10px] text-muted-foreground">
              Fingerprint / Face unlock can be switched on from your profile after your first
              sign in.
            </p>
          )}

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full pt-1 text-[11px] font-semibold text-brand"
          >
            {mode === "signin"
              ? "New here? Create a citizen account"
              : "Already registered? Sign in"}
          </button>
        </section>

        <section className="tile p-3">
          <p className="label-cap mb-2">What CivicLens does</p>
          <ul className="space-y-1.5 text-[11px] font-medium text-ink">
            <li>· Camera capture with live GPS lock on every photo</li>
            <li>· AI scan tells you if the problem photo is original or fake</li>
            <li>· Detects pothole, drainage, street light, garbage and more</li>
            <li>· Blocks repeated photos of the same spot</li>
            <li>· 3D location view of every reported issue</li>
            <li>· Auto complaint to the corporation when the in-charge does nothing</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
