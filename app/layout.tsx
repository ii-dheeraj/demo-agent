"use client";

import type { Metadata } from 'next';
import './globals.css';
import { EventProvider } from './contexts/EventContext';
import { TranscriptProvider } from './contexts/TranscriptContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Inline SVG favicon to avoid 404 for /favicon.ico */}
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%235a67d8'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-size='36' font-family='Verdana' fill='white'%3EAI%3C/text%3E%3C/svg%3E"
        />
      </head>
      <body>
        <EventProvider>
          <TranscriptProvider>
            {children}
          </TranscriptProvider>
        </EventProvider>
      </body>
    </html>
  );
}
