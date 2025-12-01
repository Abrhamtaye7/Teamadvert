import { useEffect, useState } from "react";
import api from "../lib/api";

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const res = await api.get("/notifications");
    setItems(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: number) => {
    await api.post(`/notifications/${id}/read`);
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Notifications</h2>
      <div className="card space-y-2">
        {items.map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
            <div>
              <p className="font-semibold">{n.type}</p>
              <p className="text-xs text-slate-500">{n.message}</p>
            </div>
            <button className="btn bg-slate-700 hover:bg-slate-600" onClick={() => markRead(n.id)} disabled={n.read}>
              {n.read ? "Read" : "Mark as read"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
