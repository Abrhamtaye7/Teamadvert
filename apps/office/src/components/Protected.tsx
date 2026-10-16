import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export function ProtectedRoute() {
  const { user } = useAuthStore();
  const location = useLocation();
  // Remember where the user was going so login can send them back there
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
