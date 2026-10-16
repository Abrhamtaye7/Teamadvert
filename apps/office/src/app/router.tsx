import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { RequireAuth } from "../auth/RequireAuth";
import { AppShell } from "./AppShell";

// Each page is its own chunk, so phones only download what they open.
const LoginPage = lazy(() => import("../auth/LoginPage"));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const ProformasPage = lazy(() => import("../features/proformas/ProformasPage"));
const ProformaDetailPage = lazy(() => import("../features/proformas/ProformaDetailPage"));
const JobsPage = lazy(() => import("../features/jobs/JobsPage"));
const JobDetailPage = lazy(() => import("../features/jobs/JobDetailPage"));
const CustomersPage = lazy(() => import("../features/customers/CustomersPage"));
const CustomerDetailPage = lazy(() => import("../features/customers/CustomerDetailPage"));
const SuppliersPage = lazy(() => import("../features/suppliers/SuppliersPage"));
const SupplierDetailPage = lazy(() => import("../features/suppliers/SupplierDetailPage"));
const ItemsPage = lazy(() => import("../features/items/ItemsPage"));
const ItemDetailPage = lazy(() => import("../features/items/ItemDetailPage"));
const FinancePage = lazy(() => import("../features/finance/FinancePage"));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage"));
const NotificationsPage = lazy(() => import("../features/notifications/NotificationsPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const LeadsPage = lazy(() => import("../features/leads/LeadsPage"));
const NotFoundPage = lazy(() => import("./NotFoundPage"));

export const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <DashboardPage /> },
            { path: "proformas", element: <ProformasPage /> },
            { path: "proformas/:id", element: <ProformaDetailPage /> },
            { path: "jobs", element: <JobsPage /> },
            { path: "jobs/:id", element: <JobDetailPage /> },
            { path: "customers", element: <CustomersPage /> },
            { path: "customers/:id", element: <CustomerDetailPage /> },
            { path: "suppliers", element: <SuppliersPage /> },
            { path: "suppliers/:id", element: <SupplierDetailPage /> },
            { path: "items", element: <ItemsPage /> },
            { path: "items/:id", element: <ItemDetailPage /> },
            { path: "finance", element: <FinancePage /> },
            { path: "leads", element: <LeadsPage /> },
            { path: "reports", element: <ReportsPage /> },
            { path: "notifications", element: <NotificationsPage /> },
            { path: "settings", element: <SettingsPage /> },
            { path: "*", element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: "/office" },
);
