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
  title: "CelitePro | Video Editor tool",
  description: "Professional Video Editor tool for creators.",
  icons: {
    icon: `${process.env.PUBLIC_URL_S3}/logos/celiteprologo23.png`,
  },
  openGraph: {
    title: "CelitePro | Video Editor tool",
    description: "Professional Video Editor tool for creators.",
    images: [`${process.env.PUBLIC_URL_S3}/logos/02.png`],
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
