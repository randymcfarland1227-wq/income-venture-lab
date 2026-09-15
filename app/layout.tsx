import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Income & Venture Lab",
  description: "Explore, test, and develop income opportunities in one connected workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
