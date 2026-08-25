"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps, ReactNode } from "react";

/**
 * next-themes@0.4.6 declares `interface ThemeProviderProps extends
 * React.PropsWithChildren`. `PropsWithChildren` resolves to `unknown & {
 * children?: ReactNode }`, which is not a valid `extends` target for an
 * interface — TypeScript drops the members instead. `skipLibCheck: true` hides
 * the malformed declaration, so the resulting props type silently has no
 * `children`. Re-adding it here keeps the call site honest without an `as`
 * cast (CLAUDE.md §10). Drop the intersection once upstream fixes the type.
 */
type ThemeProviderProps = ComponentProps<typeof NextThemesProvider> & {
  children: ReactNode;
};

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
