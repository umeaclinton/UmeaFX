import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UmeaFX | Cloud Algorithmic Copy Trading for Synthetics",
  description: "Automated 24/7 FX Vol 60 Algorithmic Trade Copier Engine by UmeaFX",
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
