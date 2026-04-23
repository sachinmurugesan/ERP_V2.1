import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--f-sans-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HarvestERP",
  description: "HarvestERP — Operations & Finance Management",
};

/**
 * Root layout — wraps the entire application.
 *
 * Providers mounted here:
 *   - QueryProvider: TanStack Query v5 for client components
 *   - ThemeProvider: light/dark theme state synced with localStorage
 *
 * suppressHydrationWarning on <html>: ThemeProvider reads localStorage on
 * mount to set theme; the class may differ from SSR. Suppressing prevents
 * the harmless mismatch warning.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
