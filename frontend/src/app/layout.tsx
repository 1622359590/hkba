import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "HKBA — Hong Kong Blockchain Association",
  description: "Hong Kong Blockchain Association — Dedicated to promoting blockchain technology in Hong Kong.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <body style={{ background: '#09090b', color: '#fafafa' }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
