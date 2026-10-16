import axios from "axios";
import { useAuthStore } from "../store/auth";

// Same origin as the office app; the session is an httpOnly cookie sent automatically.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginAttempt = error.config?.url === "/auth/login";
    if (error.response?.status === 401 && !isLoginAttempt) {
      useAuthStore.getState().clearSession();
      const loginPath = `${import.meta.env.BASE_URL}login`;
      if (window.location.pathname !== loginPath) window.location.href = loginPath;
    }
    return Promise.reject(error);
  }
);

export default api;
