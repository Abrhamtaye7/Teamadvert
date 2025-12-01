import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/auth";
import { hydrateAuth } from "../store/auth";

export default function Login() {
  const navigate = useNavigate();
  const { user, setSession } = useAuthStore();
  const [username, setUsername] = useState("admin");
  const [pin, setPin] = useState("0000");
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
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Login</h2>
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
        <p className="text-xs text-slate-500">Default seed: admin / 0000</p>
      </form>
    </div>
  );
}
