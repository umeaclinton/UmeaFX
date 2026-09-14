import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UmeaFX | Autonomous Quantitative Trading for Synthetics",
  description: "24/7/365 Autonomous FX Vol 60 Quantitative Algorithmic Execution System by UmeaFX",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090D14] text-gray-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
