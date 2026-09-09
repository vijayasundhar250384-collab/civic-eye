import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getActiveRole, setActiveRole, type UserRole } from "@/lib/store";

export function AppShell({
  children,
  subtitle = "Infrastructure Intelligence",
  gpsReady = true,
}: {
  children: ReactNode;
  subtitle?: string;
  gpsReady?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [role, setRole] = useState<UserRole>("CITIZEN");

  useEffect(() => {
    setRole(getActiveRole());
  }, [pathname]);

  const navItems = [
    { to: "/dashboard", label: "Home" },
    { to: "/capture", label: "Capture" },
    { to: "/map", label: "3D Map" },
    { to: "/field", label: "Field" },
    { to: "/authority", label: "Authority" },
    { to: "/profile", label: "Profile" },
  ];

  function switchRole(newRole: UserRole) {
    setActiveRole(newRole);
    setRole(newRole);
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[430px] space-y-3 px-3 pt-3 pb-28">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[10px] bg-brand text-[11px] font-extrabold tracking-tight text-brand-foreground">
              UB
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-extrabold text-ink">Urbix AI</p>
                <select
                  value={role}
                  onChange={(e) => switchRole(e.target.value as UserRole)}
                  className="rounded bg-brand/10 px-1 py-0.5 text-[8px] font-extrabold text-brand uppercase outline-none border-none"
                >
                  <option value="CITIZEN">Portal A (Citizen)</option>
                  <option value="FIELD_OFFICER">Portal B (Field)</option>
                  <option value="AUTHORITY">Portal C (Authority)</option>
                </select>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="flex items-center gap-1 rounded-full bg-frost/70 px-2 py-1 text-[10px] font-semibold text-ok ring-1 ring-border">
              <span className="size-1.5 rounded-full bg-ok" />
              SYNCED
            </span>
            <span className="flex items-center gap-1 rounded-full bg-frost/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
              <span
                className={`size-1.5 rounded-full ${gpsReady ? "bg-accent" : "bg-muted-foreground"}`}
              />
              GPS
            </span>
          </div>
        </header>

        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] px-3 pb-3">
        <div className="grid grid-cols-6 gap-1 rounded-2xl bg-frost/85 p-1.5 shadow-lg ring-1 ring-border backdrop-blur-md">
          {navItems.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${
                  active ? "bg-brand/10 text-brand" : "text-muted-foreground"
                }`}
              >
                <span className="text-[10px] font-semibold">{item.label}</span>
                <span
                  className={`size-1 rounded-full ${active ? "bg-brand" : "bg-border"}`}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Tile({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tile p-3 ${className}`}>
      {(title || right) && (
        <div className="mb-2 flex items-center justify-between">
          <p className="label-cap">{title}</p>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

