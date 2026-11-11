import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISYEN ম্যানেজমেন্ট",
  description: "ISYEN ডিভাইস ও অটোমেশন পরিচালনা প্যানেল।",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
