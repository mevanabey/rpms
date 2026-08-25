import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import {
  FlowOverlay,
  FlowProgressWidget,
} from "@/components/app/flow-overlay";
import { AppOnbordaProvider } from "@/components/app/onborda-provider";
import { SimProvider } from "@/components/app/sim-provider";
import { ThemeProvider } from "@/components/app/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FlowRunnerProvider } from "@/lib/flows/runner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RPMS — Capital Trust",
  description:
    "Rental Property Management System for the Capital Trust Holdings group.",
};

/**
 * Root layout — providers only. The dashboard chrome (sidebar, header, etc.)
 * lives in `(app)/layout.tsx` so the bare `/login` page can render full screen
 * without the shell.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <AppOnbordaProvider>
              <FlowRunnerProvider>
                <SimProvider>
                  {children}
                  <FlowOverlay />
                  <FlowProgressWidget />
                  <Toaster richColors closeButton position="bottom-right" />
                </SimProvider>
              </FlowRunnerProvider>
            </AppOnbordaProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
