import type { Metadata } from "next";
import "./globals.css";

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
 {children}
 </body>
 </html>
 );
}
