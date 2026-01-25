import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

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
    default: "CelitePro | Video Editor tool",
    template: "%s | CelitePro"
  },
  description: "Professional Video Editor tool for creators. Customize templates and render in minutes.",
  keywords: ["video editor", "automation", "after effects", "templates", "video rendering", "cloud rendering"],
  authors: [{ name: "CelitePro Team" }],
  creator: "CelitePro",
  publisher: "CelitePro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: `${process.env.PUBLIC_URL_S3}/logos/celiteprologo23.png`,
    shortcut: `${process.env.PUBLIC_URL_S3}/logos/celiteprologo23.png`,
    apple: `${process.env.PUBLIC_URL_S3}/logos/celiteprologo23.png`,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://celitepro.com",
    siteName: "CelitePro",
    title: "CelitePro | Video Editor tool",
    description: "Professional Video Editor tool for creators.",
    images: [
      {
        url: `${process.env.PUBLIC_URL_S3}/logos/02.png`,
        width: 1200,
        height: 630,
        alt: "CelitePro Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CelitePro | Video Editor tool",
    description: "Professional Video Editor tool for creators.",
    images: [`${process.env.PUBLIC_URL_S3}/logos/02.png`],
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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
