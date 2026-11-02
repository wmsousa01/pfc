import type { Estrategia } from "./store";

/**
 * Pontos de partida para uma estratégia nova, tirados dos playbooks em
 * docs/estrategia-social-patrocinadores.md e docs/roteiros-anuncio-sem-enrolacao.md.
 * A equipe ajusta tudo depois; o modelo só preenche o formulário.
 */
export type Modelo = Pick<
  Estrategia,
  "nome" | "objetivo" | "publico" | "oferta" | "mensagem" | "angulos" | "link" | "cta" | "geo_raio_km" | "idade_min" | "idade_max" | "orcamento_diario" | "kpi"
>;

export const MODELOS: Record<string, { label: string; m: Modelo }> = {
  "sem-enrolacao": {
    label: "Anúncio Sem Enrolação (patrocinadores)",
    m: {
      nome: "Anúncio Sem Enrolação — comerciante local",
      objetivo: "video",
      publico: "Donos de pequenos negócios de Mogi Guaçu e região, 30–60 anos, que hoje anunciam em rádio, carro de som ou panfleto (ou não anunciam).",
      oferta: "Piloto de 30 dias: menção no episódio + story + QR com relatório de acessos.",
      mensagem: "Anunciar sem jogar dinheiro fora: mídia local que mostra quantas pessoas viram e quantas vieram.",
      angulos: ["Anúncio ou doação?", "O problema nunca foi o meio", "3 perguntas antes de pagar"],
      link: "https://pfc-landing.vercel.app/parcerias?utm_source=meta&utm_medium=paid&utm_campaign=sem-enrolacao",
      cta: "LEARN_MORE",
      geo_raio_km: 15,
      idade_min: 30,
      idade_max: 60,
      orcamento_diario: 2000,
      kpi: "Custo por ThruPlay e pedidos de media kit em /parcerias",
    },
  },
  "piloto-30": {
    label: "Piloto de 30 dias (leads)",
    m: {
      nome: "Piloto de 30 dias — media kit",
      objetivo: "trafego",
      publico: "Comércio e serviços de Mogi Guaçu + 15 km, decisores 28–60 anos.",
      oferta: "Piloto de 30 dias com mini-relatório de resultado.",
      mensagem: "Sua marca no podcast da cidade, com QR e relatório: você vê quem veio.",
      angulos: ["Mídia local com métrica", "Case Contenta AI", "Frequência: ~44 conteúdos por semana"],
      link: "https://pfc-landing.vercel.app/parcerias?utm_source=meta&utm_medium=paid&utm_campaign=piloto-30",
      cta: "GET_QUOTE",
      geo_raio_km: 15,
      idade_min: 28,
      idade_max: 60,
      orcamento_diario: 2000,
      kpi: "Custo por lead (formulário de media kit)",
    },
  },
  "pfc-visita": {
    label: "PFC Visita (venda avulsa)",
    m: {
      nome: "PFC Visita — o episódio no seu negócio",
      objetivo: "trafego",
      publico: "Negócios locais com espaço físico (restaurantes, lojas, academias, clínicas) em Mogi Guaçu e Mogi Mirim.",
      oferta: "PFC Visita: R$ 1.690 avulso (R$ 1.350 para quem tem plano).",
      mensagem: "O podcast vai até o seu negócio e conta a sua história.",
      angulos: ["Bastidores de uma visita", "A história por trás do balcão", "O cliente que viu e foi"],
      link: "https://pfc-landing.vercel.app/pfc-visita?utm_source=meta&utm_medium=paid&utm_campaign=pfc-visita",
      cta: "LEARN_MORE",
      geo_raio_km: 20,
      idade_min: 25,
      idade_max: 60,
      orcamento_diario: 1500,
      kpi: "Cliques no link e conversas no WhatsApp",
    },
  },
  audiencia: {
    label: "Audiência do canal (cortes)",
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
      kpi: "Custo por ThruPlay e inscritos novos no canal",
    },
  },
};
