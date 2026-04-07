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
    default: "CelitePro | Video Template & Motion Graphics Editor",
    template: "%s | CelitePro"
  },
  description: "Rank #1 Video Template Maker. Edit professional video templates, create online intros, slideshows, and customize your edits in minutes.",
  keywords: [
    "video template maker", 
    "video template", 
    "video template edit", 
    "edit video online", 
    "intro video editor", 
    "slideshow video maker", 
    "online video editing", 
    "create custom video", 
    "motion graphics template", 
    "custom video maker",
    "video editor",
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
    title: "CelitePro | Video Template & Motion Graphics Editor",
    description: "Rank #1 Video Template Maker. Edit professional video templates, create online intros, slideshows, and customize your edits in minutes.",
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
    title: "CelitePro | Video Template & Motion Graphics Editor",
    description: "Rank #1 Video Template Maker. Edit professional video templates, create online intros, slideshows, and customize your edits in minutes.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
