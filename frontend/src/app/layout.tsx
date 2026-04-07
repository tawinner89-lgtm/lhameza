import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import LocaleHydrator from "@/components/LocaleHydrator";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  verification: {
    other: {
      "verify-admitad": "03779ee843",
    },
  },
  title: "L'HAMZA - الهـمزة f'Sel3a 🇲🇦",
  description: "Aji tchouf a7san deals w soldes f Maroc. iPhone, Zara, Nike, Beauty... kolchi rkhis!",
  keywords: ["deals", "maroc", "morocco", "avito", "zara", "nike", "promotion", "soldes", "hemza", "همزة"],
  authors: [{ name: "L'HAMZA F SEL'A" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "L'HAMZA - الهـمزة f'Sel3a 🔥",
    description: "Matzgelch l'hemza! A7san les deals dyal Jumia, Zara, Electroplanet f blast wa7da.",
    siteName: "L'HAMZA",
    locale: 'fr_MA',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  
  return (
    <html lang="fr">
      <head>
        {/* Google AdSense - Only load if client ID is configured */}
        {adsenseClientId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`${inter.variable} ${arabic.variable} font-sans antialiased`}>
        <LocaleHydrator />
        {children}
      </body>
    </html>
  );
}
