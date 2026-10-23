import "server-only";
import { createHash } from "crypto";
import type { ClientContract } from "./types";

/**
 * Termos de patrocínio que o cliente aceita no painel.
 *
 * O texto é montado a partir do contrato do cliente (plano, valor, vigência,
 * entregas) e versionado. O aceite grava o sha-256 do texto exato exibido:
 * se a versão for editada depois, o hash antigo continua provando o que foi
 * aceito. Mudou cláusula? Crie uma versão nova — não edite a antiga.
 *
 * Rascunho redigido em 10/2026 a partir da proposta comercial. Revisar com
 * advogado antes de usar como padrão para todos os clientes.
 */

export type TermsSection = { title: string; paragraphs: string[] };

export const CURRENT_TERMS_VERSION = "patrocinio-2026-10";

function dataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function endDate(start: string, months: number): string {
  const d = new Date(`${start}T12:00:00-03:00`);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const VERSIONS: Record<
  string,
  (clientName: string, c: ClientContract) => TermsSection[]
> = {
  "patrocinio-2026-10": (clientName, c) => [
    {
      title: "1. Partes",
      paragraphs: [
        "De um lado, o Fora da Caixa (PFC), canal de conteúdo de Mogi Guaçu/SP, representado por Willian Marinho de Sousa. De outro, " +
          `${clientName}, identificado pelo nome e documento informados no aceite abaixo.`,
      ],
    },
    {
      title: "2. O que está sendo contratado",
      paragraphs: [
        `O Plano ${c.plan} de patrocínio do PFC, que inclui:`,
        ...c.deliverables.map((d) => `• ${d}`),
      ],
    },
    {
      title: "3. Vigência",
      paragraphs: [
        `${c.months} meses, de ${dataBR(c.start)} a ${dataBR(endDate(c.start, c.months))}. ` +
          "A renovação não é automática: o PFC entra em contato até 30 dias antes do fim.",
      ],
    },
    {
      title: "4. Valor e pagamento",
      paragraphs: [`${brl(c.price)}, pagos da seguinte forma: ${c.payment}.`],
    },
    {
      title: "5. Como as entregas acontecem",
      paragraphs: [
        "As datas de gravação e publicação seguem a agenda editorial do PFC e são combinadas com o cliente com antecedência.",
        "O cliente envia o material da marca (logo, imagens, WhatsApp de atendimento e redes) em até 10 dias do aceite. Entregas que dependem desse material começam a contar a partir do recebimento.",
        "Cada entrega, com seus links, fica registrada neste painel.",
      ],
    },
    {
      title: "6. Marca, imagem e conteúdo",
      paragraphs: [
        "O cliente autoriza o uso da sua marca e do material enviado nos conteúdos do PFC durante a vigência, e garante ter os direitos sobre esse material.",
        "Conteúdos publicados durante a vigência permanecem no ar depois dela, como parte do acervo do canal.",
        "O PFC mantém sua linha editorial: não publica informação que saiba ser falsa e identifica conteúdo patrocinado como tal.",
      ],
    },
    {
      title: "7. Resultados",
      paragraphs: [
        "O PFC não garante número de visualizações, contatos ou vendas. Garante medir: acessos à página, acessos pelo QR e contatos recebidos ficam disponíveis neste painel.",
      ],
    },
    {
      title: "8. Contatos recebidos e dados pessoais",
      paragraphs: [
        "Os contatos de clientes gerados pela página do parceiro são encaminhados ao cliente para atendimento e ficam guardados pelo PFC apenas para exibição neste painel e para o relatório de resultados.",
        "Cada parte trata esses dados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), usando-os só para responder a quem fez o contato.",
      ],
    },
    {
      title: "9. Cancelamento",
      paragraphs: [
        "Por ser um plano com condição especial para o período contratado, o valor não é reembolsável depois do início da vigência.",
        "Se o PFC deixar de cumprir as entregas, devolve o valor proporcional ao período não atendido.",
      ],
    },
    {
      title: "10. Aceite eletrônico e foro",
      paragraphs: [
        "O aceite neste painel tem a mesma validade de uma assinatura. Ficam registrados nome, documento, data, hora e endereço de acesso de quem aceitou, junto com a versão destes termos.",
        "Fica eleito o foro de Mogi Guaçu/SP.",
      ],
    },
  ],
};

export function buildTerms(
  clientName: string,
  contract: ClientContract
): { version: string; sections: TermsSection[]; hash: string } | null {
  const build = VERSIONS[contract.terms_version];
  if (!build) return null;
  const sections = build(clientName, contract);
  const hash = createHash("sha256")
    .update(JSON.stringify({ v: contract.terms_version, sections }))
    .digest("hex");
  return { version: contract.terms_version, sections, hash };
}
