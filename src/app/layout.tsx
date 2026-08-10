import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ads Phase Machine — Light School",
  description:
    "A phase machine that writes, places, measures and re-writes Facebook ads for lightschool.com.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Browser extensions commonly stamp attributes onto <body> before React
          loads, which otherwise reads as a hydration mismatch. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
