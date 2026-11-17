"use server";

import { headers } from "next/headers";
import { isValidDocument } from "@/lib/client-area";
import { site } from "@/lib/config";
import { dataUrlParaBuffer, upload } from "@/lib/ads/arte-io";
import { OFERTA, novoCodigo, rotuloSemana, semanasAVenda } from "@/lib/ads/config";
import { criarPreferencia } from "@/lib/ads/mercadopago";
import { atualizar, reservar } from "@/lib/ads/store";
import { lerMarcaInstagram } from "@/lib/marca-instagram";
import { handleInstagram } from "@/lib/monte-plano";

export type CheckoutState = { error: string | null; url: string | null };

const str = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Origem desta requisição (localhost, preview ou produção), para o retorno do checkout voltar ao mesmo lugar. */
function origem(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return site.url;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Reserva a vaga e abre o Checkout Pro. Tudo é revalidado aqui: semana à
 * venda, vagas, documento, limites de texto. Logo e cor vêm de uma releitura
 * do Instagram no servidor — o que a tela mostrou não é confiável.
 */
export async function iniciarCheckout(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  if (str(fd.get("site_url"), 10)) return { error: null, url: null }; // honeypot

  const semana = str(fd.get("semana"), 10);
  if (!semanasAVenda().includes(semana)) return { error: "Escolha uma das semanas disponíveis.", url: null };

  const empresa = str(fd.get("empresa"), 80);
  const responsavel = str(fd.get("responsavel"), 80);
  const documento = str(fd.get("documento"), 20).replace(/\D/g, "");
  const email = str(fd.get("email"), 120).toLowerCase();
  const whatsapp = str(fd.get("whatsapp"), 30).replace(/\D/g, "");
  const cidade = str(fd.get("cidade"), 60);
  const titulo = str(fd.get("titulo"), OFERTA.limites.titulo);
  const descricao = str(fd.get("descricao"), OFERTA.limites.descricao);
  const ig = handleInstagram(str(fd.get("instagram"), 200)) ?? "";

  if (!empresa || !responsavel) return { error: "Informe o nome da empresa e o seu.", url: null };
  if (!isValidDocument(documento)) return { error: "CPF ou CNPJ inválido. Ele vai na nota fiscal.", url: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido.", url: null };
  if (whatsapp.length < 10 || whatsapp.length > 13) return { error: "Informe o WhatsApp com DDD. É para ele que a oferta leva os clientes.", url: null };
  if (!cidade) return { error: "Informe a cidade.", url: null };
  if (titulo.length < 4) return { error: "Escreva o título da oferta.", url: null };
  if (descricao.length < 10) return { error: "Descreva a oferta em uma ou duas frases.", url: null };
  if (fd.get("termos") !== "on") return { error: "Para seguir, aceite as regras da oferta.", url: null };

  // Instagram é opcional: sem conta comercial, a arte usa a inicial da empresa.
  const marca = ig ? await lerMarcaInstagram(ig).catch(() => null) : null;
  const cor = marca?.ok ? (marca.marca.cor ?? "") : "";

  const reservadaAte = Date.now() + OFERTA.reservaMin * 60_000;
  let id: string | null;
  try {
    id = await reservar({
      codigo: novoCodigo(),
      semana,
      empresa,
      responsavel,
      documento,
      email,
      whatsapp: whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp,
      instagram: ig,
      cidade,
      titulo,
      descricao,
      cor,
      valor_cents: OFERTA.precoCents,
      reservada_ate: new Date(reservadaAte).toISOString(),
    });
  } catch {
    return { error: "Não conseguimos reservar agora. Tente de novo em instantes.", url: null };
  }
  if (!id) return { error: `As vagas da semana de ${rotuloSemana(semana)} acabaram. Escolha outra semana.`, url: null };

  const logo = marca?.ok ? dataUrlParaBuffer(marca.marca.logo) : null;
  if (logo) {
    const path = `ads/logos/${id}.png`;
    await upload(path, logo, "image/png")
      .then(() => atualizar(id!, { logo_path: path }))
      .catch(() => null);
  }

  try {
    const pref = await criarPreferencia({
      ofertaId: id,
      titulo: `${OFERTA.nome} PFC (${rotuloSemana(semana)}): ${empresa}`,
      valorCents: OFERTA.precoCents,
      comprador: { nome: responsavel, email },
      expiraEm: reservadaAte,
      siteUrl: origem(),
      webhookBase: site.url,
    });
    await atualizar(id, { mp_preference_id: pref.id });
    return { error: null, url: pref.init_point };
  } catch {
    // Sem checkout, a vaga não pode ficar presa.
    await atualizar(id, { status: "cancelada", erro: "Falha ao criar a preferência no Mercado Pago." }).catch(() => null);
    return { error: "O pagamento está indisponível agora. Tente de novo em alguns minutos.", url: null };
  }
}
