import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Consulting',
  description: 'Speed up applicant screening with AI Consulting',
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
