import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sequence Arena — real-time multiplayer card & chip strategy",
  description:
    "Play a Sequence-style board game online with friends. Private rooms, 1v1 and 2v2, real-time play.",
};

export const viewport: Viewport = {
  themeColor: "#040817",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
