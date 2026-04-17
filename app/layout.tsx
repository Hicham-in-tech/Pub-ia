import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono, Noto_Naskh_Arabic } from "next/font/google";
import { MockProvider } from "@/components/MockProvider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "opsz"],
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-ar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rouda — FPT Taroudant",
  description: "Voice assistant for the Faculté Polydisciplinaire de Taroudant.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 1080,
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#fbf7ef",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${inter.variable} ${mono.variable} ${naskh.variable}`}
    >
      <body>
        <MockProvider>{children}</MockProvider>
        <div className="grain-overlay" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
      </body>
    </html>
  );
}
