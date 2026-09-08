import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, Tile } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  biometricEnrol,
  biometricSupported,
  clearBiometricEnrolment,
  hasBiometricEnrolment,
} from "@/lib/biometrics";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — CivicLens" },
      {
        name: "description",
        content:
          "Your CivicLens account, biometric unlock setting and your own reporting record.",
      },
      { property: "og:title", content: "Your profile — CivicLens" },
      {
        property: "og:description",
        content: "Manage your CivicLens account and biometric unlock.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [supported, setSupported] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    setEnrolled(hasBiometricEnrolment());
    biometricSupported().then(setSupported);
  }, []);

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const [profile, mine] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("reports").select("status").eq("user_id", uid),
      ]);
      return { profile: profile.data, mine: mine.data ?? [] };
    },
  });

  async function toggleBiometric() {
    try {
      if (enrolled) {
        clearBiometricEnrolment();
        setEnrolled(false);
        toast.success("Biometric unlock switched off.");
        return;
      }
      await biometricEnrol(data?.profile?.username ?? "citizen");
      setEnrolled(true);
      toast.success("Fingerprint / face unlock is on for this device.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set up biometrics.");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const mine = data?.mine ?? [];
  const solved = mine.filter((r) => r.status === "resolved").length;

  return (
    <AppShell subtitle="Your account">
      <Tile title="Account">
        <p className="text-[15px] font-extrabold text-ink">
          {data?.profile?.full_name || data?.profile?.username || "Citizen"}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          @{data?.profile?.username} · {data?.profile?.ward}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-brand/8 p-2 ring-1 ring-brand/15">
            <p className="font-mono text-lg leading-none font-extrabold text-brand">
              {mine.length}
            </p>
            <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">
              My reports
            </p>
          </div>
          <div className="rounded-lg bg-ok/8 p-2 ring-1 ring-ok/15">
            <p className="font-mono text-lg leading-none font-extrabold text-ok">{solved}</p>
            <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">Solved</p>
          </div>
        </div>
      </Tile>

      <Tile title="Biometric unlock">
        <p className="text-[11px] text-muted-foreground">
          Use this phone's fingerprint or face to open CivicLens instead of typing your
          password every time.
        </p>
        <button
          onClick={toggleBiometric}
          disabled={!supported && !enrolled}
          className={`mt-2 w-full rounded-lg py-2.5 text-[12px] font-semibold disabled:opacity-50 ${
            enrolled
              ? "bg-frost text-ink ring-1 ring-border"
              : "bg-brand text-brand-foreground"
          }`}
        >
          {enrolled ? "Turn off biometric unlock" : "Set up fingerprint / face"}
        </button>
        {!supported && !enrolled && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            This device or browser does not offer fingerprint or face unlock.
          </p>
        )}
      </Tile>

      <button
        onClick={signOut}
        className="w-full rounded-lg bg-frost/70 py-2.5 text-[12px] font-semibold text-alert ring-1 ring-border"
      >
        Sign out
      </button>
    </AppShell>
  );
}
