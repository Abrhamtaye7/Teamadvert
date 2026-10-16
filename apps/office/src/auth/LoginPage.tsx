import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { LockKeyhole } from "lucide-react";
import logo from "../assets/teamlogo.png";
import { Button } from "../components/ui/Button";
import { Field, FormError, Input } from "../components/ui/form";
import { ApiError } from "../lib/api";
import { useLogin } from "./hooks";
import { useSession } from "./session";

export default function LoginPage() {
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from || "/";
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  if (user) return <Navigate to={returnTo} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ username: username.trim(), pin }, { onSuccess: () => navigate(returnTo, { replace: true }) });
  };

  const error =
    login.error instanceof ApiError
      ? login.error.status === 400
        ? "Enter your username and 4-digit PIN."
        : login.error.message
      : login.error
        ? "Login failed. Try again."
        : null;

  return (
    <div className="flex min-h-dvh">
      <aside className="relative hidden w-1/2 overflow-hidden bg-brand-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-accent-500/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="relative flex items-center gap-3 text-white">
          <img src={logo} alt="" className="size-12 rounded-full bg-white p-1" />
          <span className="text-lg font-semibold tracking-wide">TEAM ADVERT PLC</span>
        </div>
        <div className="relative max-w-md text-white">
          <h2 className="text-4xl font-semibold leading-tight">Proformas, jobs and payments in one place.</h2>
          <p className="mt-4 text-brand-100">From the first quote to the final CBE receipt — for the whole team, on any device.</p>
        </div>
        <p className="relative text-sm text-brand-200">Team Advert Office</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <img src={logo} alt="Team Advert logo" className="size-20 rounded-full bg-white p-1.5 shadow-md" />
            <p className="mt-3 font-semibold tracking-wide text-brand-700 dark:text-brand-300">TEAM ADVERT PLC</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Use your username and 4-digit PIN.</p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <FormError message={error} />
            <Field label="Username">
              {(p) => <Input {...p} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required />}
            </Field>
            <Field label="PIN">
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="tracking-[0.5em]"
                  required
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={login.isPending} icon={LockKeyhole} disabled={!username || pin.length !== 4}>
              Sign in
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
