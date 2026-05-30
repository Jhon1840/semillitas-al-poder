import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "NEXO",
  description: "Analisis de semillas con inteligencia agricola"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

