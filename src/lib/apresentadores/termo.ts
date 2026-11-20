import { createHash } from "crypto";
import { site } from "@/lib/config";

/**
 * Termo de autorização de uso de imagem e voz que o apresentador aceita no
 * cadastro. O aceite grava a versão e o sha-256 do texto exibido: se o texto
 * mudar, o hash antigo continua provando o que foi aceito. Mudou cláusula?
 * Crie uma versão nova, não edite a antiga.
 *
 * Rascunho de 11/2026. Revisar com advogado antes de tratar como definitivo.
 */

export const TERMO_VERSAO = "imagem-apresentador-2026-11";

export type Clausula = { titulo: string; texto: string };

const VERSOES: Record<string, Clausula[]> = {
  "imagem-apresentador-2026-11": [
    {
      titulo: "1. O que você autoriza",
      texto: `Você autoriza o ${site.brand} (PFC) a usar, sem custo, sua imagem, voz, nome e os materiais que enviar nesta área em gravações, transmissões ao vivo, cortes, thumbnails, artes de divulgação, redes sociais, site e anúncios do canal.`,
    },
    {
      titulo: "2. Como o material pode ser usado",
      texto:
        "O PFC pode recortar, ajustar cor e tamanho, legendar e combinar seus materiais com outros, inclusive em artes feitas com ajuda de inteligência artificial, sem distorcer sua identidade nem associar você a algo ofensivo ou que você não disse.",
    },
    {
      titulo: "3. Prazo e lugar",
      texto:
        "A autorização vale no Brasil e no exterior, em qualquer meio digital, enquanto você não pedir para encerrar. Conteúdo já publicado pode continuar no ar depois do pedido.",
    },
    {
      titulo: "4. Sem pagamento por este termo",
      texto:
        "Este termo não gera pagamento. Qualquer remuneração pela apresentação, bônus ou comissão é combinada à parte com a produção.",
    },
    {
      titulo: "5. O que você garante",
      texto:
        "Você garante que pode enviar os materiais (fotos, logos, músicas, vídeos) e que as pessoas que aparecem neles concordaram com o uso.",
    },
    {
      titulo: "6. Encerrar e seus dados",
      texto:
        "Você pode pedir a qualquer momento que seus materiais não sejam usados em conteúdos novos, pela sua página de apresentador ou pelo WhatsApp da produção, e pedir acesso, correção ou exclusão dos seus dados pelo mesmo WhatsApp. Seus dados servem só para organizar as gravações e falar com você, conforme a política de privacidade do site.",
    },
  ],
};

export function clausulas(versao = TERMO_VERSAO): Clausula[] {
  return VERSOES[versao] ?? VERSOES[TERMO_VERSAO];
}

export function textoDoTermo(versao = TERMO_VERSAO): string {
  return clausulas(versao)
    .map((c) => `${c.titulo}\n${c.texto}`)
    .join("\n\n");
}

export function hashDoTermo(versao = TERMO_VERSAO): string {
  return createHash("sha256").update(textoDoTermo(versao)).digest("hex");
}
