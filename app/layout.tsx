import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind-siliguri",
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-bengali",
});

export const viewport: Viewport = {
  themeColor: "#064e3b",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://bongshodhara.vercel.app"
  ),
  title: {
    default: "বংশধারা | ডিজিটাল ফ্যামিলি ট্রি",
    template: "%s | বংশধারা",
  },
  description:
    "সহজে নিজের পারিবারিক বংশধারা তৈরি করুন, ডিজিটালভাবে সংরক্ষণ করুন এবং পরিচ্ছন্ন চার্ট বা PDF আকারে রপ্তানি করুন। প্রজন্ম থেকে প্রজন্মের ইতিহাস — আমাদের শিকড়, আমাদের পরিচয়।",
  applicationName: "বংশধারা",
  authors: [{ name: "বংশধারা" }],
  icons: {
    icon: [
      { url: "/images/bongshodhara-logo.gif", type: "image/gif" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/images/bongshodhara-logo.jpg", sizes: "180x180" }],
  },
  openGraph: {
    title: "বংশধারা | ডিজিটাল ফ্যামিলি ট্রি",
    description:
      "প্রজন্ম থেকে প্রজন্মের ইতিহাস — আমাদের শিকড়, আমাদের পরিচয়। সহজে নিজের পারিবারিক বংশলতিকা তৈরি ও সংরক্ষণ করুন।",
    siteName: "বংশধারা",
    locale: "bn_BD",
    type: "website",
    images: [
      {
        url: "/images/bongshodhara-logo.jpg",
        width: 1024,
        height: 1024,
        alt: "বংশধারা লোগো",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "বংশধারা | ডিজিটাল ফ্যামিলি ট্রি",
    description: "প্রজন্ম থেকে প্রজন্মের ইতিহাস — আমাদের শিকড়, আমাদের পরিচয়।",
    images: ["/images/bongshodhara-logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className={`${hindSiliguri.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-slate-50 text-slate-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
