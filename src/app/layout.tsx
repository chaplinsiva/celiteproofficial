import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LayoutClient from "@/components/layout/LayoutClient";
import { organizationSchema } from "@/lib/json-ld";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://celitepro.com'),
  title: {
    default: "CelitePro | Wedding Invitation Video Maker",
    template: "%s | CelitePro"
  },
  description: "Rank #1 Wedding Invitation Video Maker. Edit professional wedding templates, create online save the date videos, and customize your wedding invitation edits in minutes.",
  keywords: [
    "wedding invitation video maker", 
    "wedding template", 
    "wedding invitation edit", 
    "edit wedding invitation online", 
    "wedding save the date editing", 
    "save the date video maker", 
    "online wedding video editing", 
    "create wedding invitation video", 
    "wedding motion graphics", 
    "custom wedding video",
    "wedding video editor",
    "wedding reel edit"
  ],
  authors: [{ name: "CelitePro Team" }],
  creator: "CelitePro",
  publisher: "CelitePro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://celitepro.com",
    siteName: "CelitePro",
    title: "CelitePro | Wedding Invitation Video Maker",
    description: "Rank #1 Wedding Invitation Video Maker. Edit professional wedding templates, create online save the date videos, and customize your wedding invitation edits in minutes.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "CelitePro Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CelitePro | Wedding Invitation Video Maker",
    description: "Rank #1 Wedding Invitation Video Maker. Edit professional wedding templates, create online save the date videos, and customize your wedding invitation edits in minutes.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

import ScratchCardGiftModal from "@/components/ScratchCardGiftModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Razorpay Checkout */}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />
        {/* Google Analytics */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-F1MF9WDF1N" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-F1MF9WDF1N');
          `}
        </Script>

        <LayoutClient>
          {children}
        </LayoutClient>
        <ScratchCardGiftModal />
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
