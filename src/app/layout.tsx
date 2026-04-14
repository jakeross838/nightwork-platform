import type { Metadata } from "next";
import "./globals.css";
import ConnectionBanner from "@/components/connection-banner";

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
 <html lang="en">
 <body className="grain antialiased">
 <ConnectionBanner />
 {children}
 </body>
 </html>
 );
}
