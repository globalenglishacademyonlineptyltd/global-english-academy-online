import "./globals.css";

export const metadata = {
  title: "Global English Academy Online",
  description: "Online English school management and learning platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}