import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Yawgriva — Rantai Pasok Hortikultura Cerdas & Traceability",
    template: "%s | Yawgriva",
  },
  description:
    "Yawgriva adalah platform hortikultura terintegrasi AI yang memprediksi harga pangan, mengoptimalkan rute logistik untuk menjaga kesegaran produk, serta melacak traceability komoditas dari kebun ke meja makan secara real-time.",
  keywords: [
    "yawgriva",
    "hortikultura",
    "pertanian cerdas",
    "supply chain pertanian",
    "traceability pangan",
    "kecerdasan buatan pertanian",
    "prediksi harga cabai",
    "logistik sayur segar",
    "agritech indonesia",
    "petani indonesia"
  ],
  authors: [{ name: "Yawgriva Team" }],
  creator: "Yawgriva",
  publisher: "Yawgriva",
  metadataBase: new URL("https://yawgriva.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Yawgriva — Rantai Pasok Hortikultura Cerdas & Traceability",
    description:
      "Platform agritech terintegrasi AI untuk prediksi harga pangan harian, optimalisasi rute pengiriman logistik, dan pelacakan batch sayur/buah dari kebun secara real-time.",
    url: "https://yawgriva.com",
    siteName: "Yawgriva",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/images/logo-with-text.png",
        width: 800,
        height: 600,
        alt: "Yawgriva Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yawgriva — Rantai Pasok Hortikultura Cerdas & Traceability",
    description:
      "Optimalkan rantai pasok hortikultura dengan AI untuk prediksi harga, rute logistik berbasis kesegaran, dan traceability real-time.",
    images: ["/images/logo-with-text.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
