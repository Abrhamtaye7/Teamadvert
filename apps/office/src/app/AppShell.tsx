import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu, Moon, Sun } from "lucide-react";
import logo from "../assets/teamlogo.png";
import { useLogout } from "../auth/hooks";
import { useSession } from "../auth/session";
import { Dialog } from "../components/ui/Dialog";
import { PageLoader } from "../components/ui/display";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import type { AppNotification } from "../lib/types";
import { visibleNav, type NavItem } from "./nav";
import { useTheme } from "./theme";

/** Unread notifications, polled every minute (shared hosting doesn't do websockets reliably). */
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<AppNotification[]>("/notifications"),
    refetchInterval: 60_000,
  });
}

function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSession((s) => s.user);
  const { theme, toggle } = useTheme();
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <div className="space-y-1 border-t border-line pt-3">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold uppercase text-white">
          {user?.username.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user?.username}</p>
          <p className="text-xs text-ink-subtle">{user?.role}</p>
        </div>
      </div>
      <button type="button" onClick={toggle} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink">
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <button
        type="button"
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => {
              onNavigate?.();
              navigate("/login", { replace: true });
            },
          })
        }
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </div>
  );
}

function NavLinks({ items, onNavigate, unread }: { items: NavItem[]; onNavigate?: () => void; unread: number }) {
  return (
    <nav className="space-y-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )
          }
        >
          <Icon className="size-[18px]" />
          <span className="flex-1">{label}</span>
          {to === "/notifications" && unread > 0 && (
            <span className="rounded-full bg-accent-500 px-1.5 text-xs font-semibold text-brand-950">{unread}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const user = useSession((s) => s.user);
  const items = visibleNav(user);
  const primary = items.filter((i) => i.primary);
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
        <Link to="/" className="mb-6 flex items-center gap-3 px-3">
          <img src={logo} alt="" className="size-9" />
          <div>
            <p className="text-sm font-bold tracking-wide text-brand-700 dark:text-brand-300">TEAM ADVERT</p>
            <p className="text-xs text-ink-subtle">Office</p>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavLinks items={items} unread={unread} />
        </div>
        <UserFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="size-8" />
            <span className="text-sm font-bold tracking-wide text-brand-700 dark:text-brand-300">TEAM ADVERT</span>
          </Link>
          <div className="flex-1" />
          <Link to="/notifications" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="relative rounded-lg p-2 text-ink-muted">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-1 top-1 size-2.5 rounded-full bg-accent-500 ring-2 ring-surface" />}
          </Link>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>

        {/* Phone bottom bar */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
          {primary.map(({ to, label, short, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-brand-700 dark:text-brand-300" : "text-ink-subtle")}
            >
              <Icon className="size-5" />
              {short ?? label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-subtle">
            <Menu className="size-5" />
            More
          </button>
        </nav>
      </div>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        <NavLinks items={items} unread={unread} onNavigate={() => setMoreOpen(false)} />
        <div className="mt-4">
          <UserFooter onNavigate={() => setMoreOpen(false)} />
        </div>
      </Dialog>
    </div>
  );
}
