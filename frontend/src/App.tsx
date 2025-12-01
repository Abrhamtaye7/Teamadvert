import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { ProtectedRoute } from "./components/Protected";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Items from "./pages/Items";
import Proformas from "./pages/Proformas";
import Jobs from "./pages/Jobs";
import Payments from "./pages/Payments";
import Notifications from "./pages/Notifications";
import Login from "./pages/Login";
import { hydrateAuth } from "./store/auth";
import { useUiStore } from "./store/ui";

export default function App() {
  const { theme, setTheme } = useUiStore();

  useEffect(() => {
    hydrateAuth();
    setTheme(theme);
  }, [theme, setTheme]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/items" element={<Items />} />
          <Route path="/proformas" element={<Proformas />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
      </Route>
    </Routes>
  );
}
