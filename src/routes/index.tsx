import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/civic";
import { biometricUnlock, hasBiometricEnrolment } from "@/lib/biometrics";
import { setActiveRole, type UserRole } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Urbix AI — Infrastructure Intelligence Platform" },
      {
        name: "description",
        content:
          "Evidence-driven civic infrastructure intelligence converting citizen observations into verified, predictive, budget-aware maintenance decisions.",
      },
      { property: "og:title", content: "Urbix AI — Infrastructure Intelligence Platform" },
      {
        property: "og:description",
        content:
          "AI photo verification, EXIF location lock, Digital Twin asset tracking, failure prediction & budget optimizer.",
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
  const [selectedRole, setSelectedRole] = useState<UserRole>("CITIZEN");
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
      setActiveRole(selectedRole);
      const email = usernameToEmail(username);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username.trim().toLowerCase(), full_name: fullName, ward, role: selectedRole },
          },
        });
        if (error) throw error;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (selectedRole === "FIELD_OFFICER" || selectedRole === "CONTRACTOR") {
        navigate({ to: "/field", replace: true });
      } else if (selectedRole === "AUTHORITY" || selectedRole === "ADMIN") {
        navigate({ to: "/authority", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  function quickDemoLogin(role: UserRole) {
    setActiveRole(role);
    toast.success(`Accessing Urbix AI as ${role.replace("_", " ")}`);
    if (role === "FIELD_OFFICER" || role === "CONTRACTOR") {
      navigate({ to: "/field", replace: true });
    } else if (role === "AUTHORITY" || role === "ADMIN") {
      navigate({ to: "/authority", replace: true });
    } else {
      navigate({ to: "/dashboard", replace: true });
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
            UB
          </span>
          <div className="leading-tight">
            <h1 className="text-[17px] font-extrabold tracking-tight text-ink">Urbix AI</h1>
            <p className="text-[11px] font-medium text-muted-foreground">
              Infrastructure Intelligence &amp; Decision Platform
            </p>
          </div>
        </div>

        {/* User Portal Selector */}
        <section className="tile p-3 space-y-2">
          <p className="label-cap">Select Portal Portal</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedRole("CITIZEN")}
              className={`rounded-lg py-2 px-1 text-center text-[10px] font-bold ring-1 transition-all ${
                selectedRole === "CITIZEN"
                  ? "bg-brand text-brand-foreground ring-brand shadow-sm"
                  : "bg-frost/70 text-ink ring-border"
              }`}
            >
              Citizen
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole("FIELD_OFFICER")}
              className={`rounded-lg py-2 px-1 text-center text-[10px] font-bold ring-1 transition-all ${
                selectedRole === "FIELD_OFFICER" || selectedRole === "CONTRACTOR"
                  ? "bg-brand text-brand-foreground ring-brand shadow-sm"
                  : "bg-frost/70 text-ink ring-border"
              }`}
            >
              Field / Officer
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole("AUTHORITY")}
              className={`rounded-lg py-2 px-1 text-center text-[10px] font-bold ring-1 transition-all ${
                selectedRole === "AUTHORITY" || selectedRole === "ADMIN"
                  ? "bg-brand text-brand-foreground ring-brand shadow-sm"
                  : "bg-frost/70 text-ink ring-border"
              }`}
            >
              Authority / Admin
            </button>
          </div>
        </section>

        {/* Quick Demo Access Buttons */}
        <section className="tile-solid p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="label-cap text-brand">Demo Quick Access</p>
            <span className="font-mono text-[8px] font-bold bg-brand/10 text-brand px-1.5 py-0.5 rounded">
              SIH EVALUATION MODE
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => quickDemoLogin("CITIZEN")}
              className="rounded-lg bg-frost py-2 text-[10px] font-bold text-ink ring-1 ring-border hover:bg-brand/10 hover:text-brand"
            >
              Portal A: Citizen
            </button>
            <button
              onClick={() => quickDemoLogin("FIELD_OFFICER")}
              className="rounded-lg bg-frost py-2 text-[10px] font-bold text-ink ring-1 ring-border hover:bg-brand/10 hover:text-brand"
            >
              Portal B: Field
            </button>
            <button
              onClick={() => quickDemoLogin("AUTHORITY")}
              className="rounded-lg bg-frost py-2 text-[10px] font-bold text-ink ring-1 ring-border hover:bg-brand/10 hover:text-brand"
            >
              Portal C: Authority
            </button>
          </div>
        </section>

        <section className="tile space-y-2.5 p-4">
          <div className="flex items-center justify-between">
            <p className="label-cap">{mode === "signin" ? "Sign in" : "Create account"}</p>
            <span className="font-mono text-[9px] font-semibold text-brand">
              {selectedRole} PORTAL
            </span>
          </div>

          <form onSubmit={submit} className="space-y-1.5">
            <label className="block rounded-lg bg-frost/70 px-2.5 py-2 ring-1 ring-border">
              <span className="text-[9px] font-medium text-muted-foreground">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder={
                  selectedRole === "CITIZEN"
                    ? "a.verma_07"
                    : selectedRole === "FIELD_OFFICER"
                      ? "officer.singh"
                      : "director.municipal"
                }
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
              ? "New here? Create a portal account"
              : "Already registered? Sign in"}
          </button>
        </section>

        <section className="tile p-3">
          <p className="label-cap mb-2">Urbix AI Intelligence Architecture</p>
          <ul className="space-y-1.5 text-[11px] font-medium text-ink">
            <li>· Multi-Source Location (EXIF GPS + Device + Map Pin + Visual OCR)</li>
            <li>· Modular AI Explainable Evidence &amp; Severity Diagnostics</li>
            <li>· Multi-Factor Duplicate Detection (Spatial, Image, Description)</li>
            <li>· Digital Twin Asset Health &amp; Infrastructure Dependency Graph</li>
            <li>· Failure Prediction Engine &amp; Cascading Risk Propagation</li>
            <li>· AI-Informed Budget-Constrained Maintenance Optimizer</li>
            <li>· AI Proof-of-Resolution &amp; Contractor Durability Scoring</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

