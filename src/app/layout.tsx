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
  title: "しるべ／SougiAgent｜死亡後の確認と手続き",
  description:
    "本人が残した記録を手掛かりに、書類の不一致を関係者へ確認し、許可証の引渡しまで追う体験版です。",
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
