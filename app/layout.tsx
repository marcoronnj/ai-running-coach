import type { Metadata } from "next";
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
  title: "Veiro",
  description: "Performance running intelligence",
  icons: {
    icon: "/icon.png",
  },
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
    >
      <body className="flex min-h-full flex-col bg-app-bg text-app-text">
        <AppStartupLoader />
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
