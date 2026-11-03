import type { Estrategia } from "./store";

/**
 * Pontos de partida para uma estratégia nova: as três campanhas do plano de
 * nov/2026 a jan/2027 (plano.ts) e a de audiência, fora do plano. Os textos
 * vêm de docs/estrategia-social-patrocinadores.md e dos roteiros de anúncio.
 * Os nomes casam a estratégia com a pauta da página de criativos: mudar um
 * nome aqui desliga as estratégias já criadas com o nome antigo.
 */
export type Modelo = Pick<
  Estrategia,
  "nome" | "objetivo" | "publico" | "oferta" | "mensagem" | "angulos" | "link" | "cta" | "geo_raio_km" | "idade_min" | "idade_max" | "orcamento_diario" | "kpi" | "inicio" | "fim"
>;

const SITE = "https://www.pfctv.com.br";

export const MODELOS: Record<string, { label: string; m: Modelo }> = {
  "sem-enrolacao": {
    label: "C1 · Anúncio Sem Enrolação (topo)",
    m: {
      nome: "Anúncio Sem Enrolação — comerciante local",
      objetivo: "video",
      publico: "Donos de pequenos negócios de Mogi Guaçu e região, 30–60 anos, que hoje anunciam em rádio, carro de som ou panfleto (ou não anunciam).",
      oferta: "Conteúdo, não oferta: a régua para anunciar sem jogar dinheiro fora. Quem vê 50% vira público de remarketing da C2.",
      mensagem: "Anunciar sem jogar dinheiro fora: mídia local que mostra quantas pessoas viram e quantas vieram.",
      angulos: ["806 mil. Guarda esse número.", "Anúncio ou doação?", "O problema nunca foi o meio", "3 perguntas antes de pagar"],
      link: `${SITE}/como-anunciar?utm_source=meta&utm_medium=paid&utm_campaign=sem-enrolacao`,
      cta: "LEARN_MORE",
      geo_raio_km: 15,
      idade_min: 30,
      idade_max: 60,
      orcamento_diario: 700,
      inicio: "2026-11-10",
      fim: null,
      kpi: "Custo por ThruPlay; retenção em 3 s ≥ 25% por gancho",
    },
  },
  "piloto-30": {
    label: "C2 · Piloto de 30 dias e media kit (fundo)",
    m: {
      nome: "Piloto de 30 dias — media kit",
      objetivo: "trafego",
      publico: "Remarketing: quem viu 50% da C1 ou interagiu com o perfil em 90 dias. Enquanto esse público tiver menos de 1.000 pessoas, somar comércio e serviços de Mogi Guaçu + 15 km, 28–60 anos.",
      oferta: "Piloto de 30 dias: menção no programa + story + QR com mini-relatório.",
      mensagem: "Sua marca no podcast da cidade, com QR e relatório: você vê quem veio.",
      angulos: ["Seu negócio aparecendo aqui. E você sabendo quanta gente viu.", "Dono de loja em Guaçu, esse é pra você.", "Anunciar sem saber se funcionou? Aqui não."],
      link: `${SITE}/parcerias?utm_source=meta&utm_medium=paid&utm_campaign=piloto-30`,
      cta: "GET_QUOTE",
      geo_raio_km: 15,
      idade_min: 28,
      idade_max: 60,
      orcamento_diario: 700,
      inicio: "2026-11-10",
      fim: "2026-12-20",
      kpi: "Pedidos de media kit + conversas no WhatsApp; alvo de R$ 25 por contato",
    },
  },
  "pfc-visita": {
    label: "C3 · PFC Visita fim de ano (fundo)",
    m: {
      nome: "PFC Visita — o episódio no seu negócio",
      objetivo: "trafego",
      publico: "Negócios locais com espaço físico (lojas, restaurantes, academias, clínicas) em Mogi Guaçu e Mogi Mirim, 25–60 anos.",
      oferta: "PFC Visita: episódio sobre o negócio, 4 shorts, collab, QR + página por 30 dias. Preço só no remarketing.",
      mensagem: "Quem grava em novembro chega a dezembro com episódio, shorts e QR rodando.",
      angulos: ["E se o próximo episódio fosse sobre o seu negócio?", "Vendeu tudo pra apostar em purificador de água. Virou episódio.", "A gente sai do estúdio e vai até você."],
      link: `${SITE}/pfc-visita?utm_source=meta&utm_medium=paid&utm_campaign=pfc-visita`,
      cta: "LEARN_MORE",
      geo_raio_km: 20,
      idade_min: 25,
      idade_max: 60,
      orcamento_diario: 600,
      inicio: "2026-11-17",
      fim: "2026-12-13",
      kpi: "Conversas no WhatsApp e Visitas agendadas",
    },
  },
  audiencia: {
    label: "Audiência do canal (fora do plano atual)",
    m: {
      nome: "Audiência — cortes que mais performam",
      objetivo: "video",
      publico: "Moradores de Mogi Guaçu e região, 18–55 anos.",
      oferta: "Episódios completos no YouTube, toda semana.",
      mensagem: "O podcast da sua cidade: conversa de verdade com quem faz Mogi Guaçu.",
      angulos: ["Comportamento e psicologia", "Histórias locais", "Bastidores do estúdio"],
      link: "https://www.youtube.com/@PapoForadaCaixa",
      cta: "WATCH_MORE",
      geo_raio_km: 25,
      idade_min: 18,
      idade_max: 55,
      orcamento_diario: 1000,
      inicio: null,
      fim: null,
      kpi: "Custo por ThruPlay e inscritos novos no canal",
    },
  },
};
