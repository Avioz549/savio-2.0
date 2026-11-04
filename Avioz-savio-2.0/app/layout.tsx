import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SAVIO — הכסף שלך. העתיד שלך.",
  description: "Your money. Your future. Personal finance, shifts and savings.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SAVIO" },
};
export const viewport: Viewport = { themeColor: "#0b100e" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
