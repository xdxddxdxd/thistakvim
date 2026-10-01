import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fredoka/wght.css";
import "@fontsource-variable/dm-sans/wght.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Haftalık Plan",
  description: "Planla. Yap. İşaretle. Haftalık çalışma planın.",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7ef",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
