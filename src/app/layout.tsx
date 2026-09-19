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
  title: "しるべ／SougiAgent｜葬儀の事前準備",
  description:
    "本人の話を聞いて希望を整理し、共有を許可された情報を家族に引き継ぐ体験版です。",
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
