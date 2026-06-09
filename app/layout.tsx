import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fusion NLE — ブラウザ動画編集",
  description:
    "Premiere Pro と Final Cut Pro の良さを合体させた、インストール不要のブラウザ動画編集ツール。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
