import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import AppStartupLoader from "@/app/components/AppStartupLoader";
import AppFooter from "@/app/components/AppFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const satoshi = localFont({
  src: "./fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Veiro",
  title: "Veiro",
  description: "Performance running intelligence",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Veiro",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${satoshi.variable} h-full bg-app-bg antialiased`}
      style={{ backgroundColor: "#050505", colorScheme: "dark" }}
    >
      <body
        className="flex min-h-full flex-col bg-app-bg text-app-text"
        style={{ backgroundColor: "#050505", color: "#f5f5f5" }}
      >
        <AppStartupLoader />
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
