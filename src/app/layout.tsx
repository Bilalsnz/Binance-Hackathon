import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: {
    default: "Mandate — the policy layer for AI agents that trade Binance",
    template: "%s · Mandate",
  },
  description:
    "Your AI can trade. Your rules decide whether it can. Mandate evaluates every agent action against your mandate before anything touches an exchange — approved, blocked, audited.",
  applicationName: "Mandate",
  keywords: [
    "Binance Agent OS",
    "AI agent safety",
    "trading policy engine",
    "hackathon",
    "agent guardrails",
  ],
};

export const viewport: Viewport = {
  themeColor: "#060913",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
