import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/auth";
import { hydrateAuth } from "../store/auth";

export default function Login() {
  const navigate = useNavigate();
  const { user, setSession } = useAuthStore();
  const [username, setUsername] = useState("admin");
  const [pin, setPin] = useState("3805");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hydrateAuth();
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/login", { username, pin });
      setSession(res.data);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4">
        {/* Make the card a positioning context and add top padding for the logo */}
        <div className="relative pt-17">
          {/* Logo wrapper: half outside, half inside the card, centered */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <div className="h-20 w-20 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden">
              <img
          src="/teamlogo.png"
          alt="Logo"
          className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>

          {/* Add top padding so content is not covered by logo */}
          <div className="pt-12 w-full text-center">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Welcome Back!
            </h2>
            <h2 className="text-l font-semibold text-slate-300 dark:text-white">
              Team Advert Login Page!
            </h2>
          </div>

          <div>
          <label className="text-sm text-slate-500">Username</label>
          <input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="text-sm text-slate-500">4-digit PIN</label>
          <input className="input mt-1" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="btn w-full" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
