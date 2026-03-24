import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/lib/api";

type User = { id: string; name: string; role: string };
type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet(["token", "user"]).then(([t, u]) => {
      if (t[1]) setToken(t[1]);
      if (u[1]) setUser(JSON.parse(u[1]));
      setLoading(false);
    });
  }, []);

  const persist = async (tok: string, usr: User) => {
    await AsyncStorage.multiSet([["token", tok], ["user", JSON.stringify(usr)]]);
    setToken(tok);
    setUser(usr);
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await persist(data.token, data.user);
  };

  const register = async (formData: Record<string, string>) => {
    const { data } = await api.post("/auth/register", formData);
    await persist(data.token, data.user);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["token", "user"]);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
