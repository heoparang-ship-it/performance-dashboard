"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, AuthUser } from "@/lib/api";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
});

export const useAuth = () => useContext(Ctx);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("auth_user");

    if (token && savedUser) {
      api
        .getMe()
        .then((u) => {
          setUser(u);
          localStorage.setItem("auth_user", JSON.stringify(u));
        })
        .catch(() => {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem("auth_token", res.access_token);
    localStorage.setItem("auth_user", JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const isAdmin = user?.role === "master" || user?.role === "admin";

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </Ctx.Provider>
  );
}
