"use client";

import { useEffect, useState } from "react";

const AUTH_KEY = "club-session";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(AUTH_KEY) : null;
    setIsAuthenticated(stored === "authenticated");
    setIsLoading(false);
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === "test" && password === "123") {
      localStorage.setItem(AUTH_KEY, "authenticated");
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, login, logout };
}

export function isAuthenticatedClient(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "authenticated";
}
