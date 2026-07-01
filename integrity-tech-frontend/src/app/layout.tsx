import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Integrity Tech',
  description: 'Plataforma resiliente de evaluaciones con auditoría forense',
  icons: {
    icon: '/integrity-logo-2.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
