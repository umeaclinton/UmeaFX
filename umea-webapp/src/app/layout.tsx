import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "UmeaFX | Autonomous Quantitative Trading for Synthetics",
  description: "24/7/365 Autonomous Quantitative Algorithmic Execution System for Synthetics by UmeaFX",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UmeaFX",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased selection:bg-emerald-500 selection:text-white">
        <ThemeProvider>
          <PwaInstallPrompt />
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
