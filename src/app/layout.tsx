import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { DemoBanner } from "@/components/demo-banner";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SougiAgent｜葬儀の事前準備",
  description:
    "葬儀の見積もりの分からないところを確認し、希望と費用を家族に残す体験版です。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
