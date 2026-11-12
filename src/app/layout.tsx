import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestión de Taller",
  description: "Recepción, taller, incidencias y entrega de vehículos",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icono-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Taller", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
