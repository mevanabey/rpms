"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

import type { AppUser } from "@/lib/demo/identity";
import { useDemoStore } from "@/lib/demo/store";

const AuthIdentityContext = createContext<AppUser | null>(null);

/**
 * Injects the server-resolved Supabase AppUser into the client tree.
 *
 * Two reasons it exists:
 *  1. Components that read `useCurrentUser()` get the real user without
 *     waiting for Zustand to hydrate from localStorage.
 *  2. It bridges into the Zustand `currentUserId` so legacy hooks keep
 *     working until everything's migrated off the demo store.
 */
export function AuthIdentityProvider({
  user,
  children,
}: {
  user: AppUser | null;
  children: ReactNode;
}) {
  const setAuthUser = useDemoStore((s) => s.setAuthUser);

  useEffect(() => {
    setAuthUser(user);
  }, [user, setAuthUser]);

  return (
    <AuthIdentityContext.Provider value={user}>
      {children}
    </AuthIdentityContext.Provider>
  );
}

export function useAuthIdentity(): AppUser | null {
  return useContext(AuthIdentityContext);
}
