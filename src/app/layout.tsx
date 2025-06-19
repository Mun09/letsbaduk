import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | 레츠고바둑",
    default: "레츠고바둑 | 바둑 스스로 둬보기",
  },
  description: "바둑을 웹에서 바로 둬보세요.",
  openGraph: {
    siteName: "레츠고바둑",
    images: {
      url: "/favicon.png",
    },
  },
  twitter: {
    title: "레츠고바둑",
    images: {
      url: "/favicon.png",
    },
  },
  verification: {
    google: "ua8RHsOqlcfoSdqMhzQeomVnm39vhNESjYHPYJtcrqY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <meta
        name="google-site-verification"
        content="ua8RHsOqlcfoSdqMhzQeomVnm39vhNESjYHPYJtcrqY"
      />
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5829493135560636"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
