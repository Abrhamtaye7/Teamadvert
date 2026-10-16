import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "./hooks";
import { useSession } from "./session";

/** Guards the office routes; remembers where the user was going so login can return there. */
export function RequireAuth() {
  const user = useSession((s) => s.user);
  const location = useLocation();
  useMe(!!user);
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
