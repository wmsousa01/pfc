import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Papo Fora da Caixa | Patrocínios e Parcerias",
  description:
    "Coloque sua marca no centro da conversa da cidade com o Papo Fora da Caixa. O podcast independente de Mogi Guaçu com +90 mil visualizações mensais.",
  keywords:
    "podcast patrocínio, parceria comercial, publicidade local, Mogi Guaçu, Papo Fora da Caixa, PFC, marketing podcast",
  authors: [{ name: "Papo Fora da Caixa" }],
  openGraph: {
    title: "Papo Fora da Caixa | Patrocínios e Parcerias",
    description:
      "Coloque sua marca no centro da conversa da cidade com o Papo Fora da Caixa.",
    type: "website",
    locale: "pt_BR",
    siteName: "Papo Fora da Caixa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Papo Fora da Caixa | Patrocínios e Parcerias",
    description:
      "Coloque sua marca no centro da conversa da cidade com o Papo Fora da Caixa.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>{children}</body>
    </html>
  );
}
