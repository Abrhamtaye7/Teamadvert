import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useUiStore } from "../store/ui";
import logo from "../assets/teamlogo.png";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/proformas", label: "Proformas" },
  { to: "/jobs", label: "Job Orders" },
  { to: "/customers", label: "Customers" },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/items", label: "Items" },
  { to: "/payments", label: "Finance" },
  { to: "/notifications", label: "Notifications" },
];

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useUiStore();

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <aside className="w-64 border-r border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-8 flex items-center gap-3">
            <img src={logo} alt="Team Advert logo" className="h-10 w-10 rounded-lg border border-primary/10 bg-primary/10 p-1" />
            <div>
              <h1 className="text-lg font-bold text-primary">TEAM ADVERT</h1>
              <p className="text-xs text-slate-500">Workflow Suite</p>
            </div>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition hover:bg-primary/10 ${
                    isActive ? "bg-primary/10 text-primary" : "text-slate-700 dark:text-slate-200"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-10 space-y-2 text-sm">
            <button onClick={toggleTheme} className="btn w-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900">
              Toggle {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="btn w-full bg-red-600 hover:bg-red-500"
            >
              Logout
            </button>
          </div>
          {user && (
            <div className="mt-6 text-xs text-slate-500">
              Signed in as <span className="font-semibold text-slate-700 dark:text-slate-200">{user.username}</span>
              <div className="text-slate-400">Role: {user.role}</div>
            </div>
          )}
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
