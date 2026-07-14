import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Fora da Caixa | O hub do podcast de Mogi Guaçu",
  description:
    "O ecossistema de conteúdo regional de Mogi Guaçu: lives semanais, quadros especializados e Shorts diários. Assista aos episódios, conheça os quadros e conecte sua marca à conversa da cidade.",
  keywords:
    "Fora da Caixa, Papo Fora da Caixa, podcast Mogi Guaçu, PFC, lives, quadros, PFC News, PFC Visita, Lado A Lado B, Tateios Escolares, patrocínio podcast, parceria local",
  authors: [{ name: "Fora da Caixa" }],
  metadataBase: new URL("https://foradacaixa.com.br"),
  openGraph: {
    title: "Fora da Caixa | O hub do podcast de Mogi Guaçu",
    description:
      "Lives semanais, quadros especializados e Shorts diários. Assista, ouça e conecte sua marca à conversa da cidade.",
    type: "website",
    locale: "pt_BR",
    siteName: "Fora da Caixa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fora da Caixa | O hub do podcast de Mogi Guaçu",
    description:
      "Lives semanais, quadros especializados e Shorts diários. Assista, ouça e conecte sua marca à conversa da cidade.",
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
