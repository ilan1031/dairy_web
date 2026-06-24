import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DairySync ERP Ledger",
  description: "Offline-first dairy management ledger and sync engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
