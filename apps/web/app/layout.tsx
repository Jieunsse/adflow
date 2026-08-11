import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://adflow.jocodingax.ai"),
  title: "AdFlow — AI Marketing Automation",
  description: "AI가 광고 소재를 만들고, Meta에 집행하고, 성과를 분석해요.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "AdFlow",
    title: "AdFlow — AI Marketing Automation",
    description: "AI가 광고 소재를 만들고, Meta에 집행하고, 성과를 분석해요.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "AdFlow 로그인 화면" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AdFlow — AI Marketing Automation",
    description: "AI가 광고 소재를 만들고, Meta에 집행하고, 성과를 분석해요.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
