import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { PWAProvider } from "@/components/PWAProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "BJI Dawati Brothers - জামায়াতের সহযোগী",
    template: "%s | BJI Dawati Brothers",
  },
  description: "Call Center & Dawati Activity Management System",
  applicationName: "Dawati Brothers",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dawati Brothers",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "./icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "./icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "./icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
        <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <PWAProvider>{children}</PWAProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
