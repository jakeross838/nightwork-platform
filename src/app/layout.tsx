import type { Metadata } from "next";
import { Instrument_Serif, Figtree } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ross Command Center",
  description: "Invoice processing and draw generation for Ross Built Custom Homes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${figtree.variable}`}>
      <body className="grain antialiased">
        {children}
      </body>
    </html>
  );
}
