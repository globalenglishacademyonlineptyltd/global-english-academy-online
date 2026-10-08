import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://globalenglishacademyonline.co.za";
const siteTitle = "Global English Academy Online (Pty) Ltd";
const siteDescription = "Speak • Learn • Succeed";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  icons: {
    icon: "/gea-logo.jpg",
    apple: "/gea-logo.jpg",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/gea-logo.jpg",
        width: 256,
        height: 256,
        alt: siteTitle,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/gea-logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
