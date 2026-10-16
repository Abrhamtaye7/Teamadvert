import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./app/router";
import { useTheme } from "./app/theme";
import { useSession } from "./auth/session";
import { PageLoader } from "./components/ui/display";
import { ApiError, onUnauthorized } from "./lib/api";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't hammer the server on auth/validation errors
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

// Session expired or revoked: drop the cached user; RequireAuth sends them to the login page.
onUnauthorized(() => {
  useSession.getState().clear();
  queryClient.clear();
});

function App() {
  const theme = useTheme((s) => s.theme);
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<PageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster position="top-center" richColors closeButton theme={theme} />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
