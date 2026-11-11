import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISYEN — আপনার ঘরের ছন্দ",
  description: "আপনার স্মার্ট হোম, শক্তি ব্যবহার ও ডিভাইসের অবস্থা এক জায়গায় দেখুন।",
  applicationName: "ISYEN",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f5f0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
