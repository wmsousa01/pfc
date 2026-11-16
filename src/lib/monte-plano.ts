/**
 * Monte seu plano (/monte-seu-plano): o visitante conta da marca e dos
 * objetivos, a gente sugere a combinação e ele liga/desliga os itens vendo o
 * preço mudar. O resultado é uma estimativa que vai para o comercial fechar —
 * não é checkout com pagamento.
 *
 * Tudo aqui é puro (sem React, sem Supabase): o cliente usa para a tela e o
 * servidor recalcula no envio, para o lead nunca chegar com total adulterado.
 */
import { quadros, quadroSponsorship, type Quadro } from "@/lib/config";
import { plans, planById } from "@/lib/planos";

// ---------------------------------------------------------------- briefing

export const OBJETIVOS = [
  { id: "lembranca", label: "Ser lembrado na cidade", hint: "Seu nome aparecendo toda semana" },
  { id: "contatos", label: "Gerar contatos e vendas", hint: "Gente chamando no WhatsApp, indo à loja" },
  { id: "vitrine", label: "Mostrar meu espaço ou produto", hint: "A câmera dentro do seu negócio" },
  { id: "autoridade", label: "Virar referência no meu segmento", hint: "Ser a marca que entende do assunto" },
  { id: "publico", label: "Falar com um público específico", hint: "Esporte, empreendedores, notícias…" },
  { id: "lancamento", label: "Lançar algo novo ou um evento", hint: "Produto, unidade, inauguração" },
] as const;
export type Objetivo = (typeof OBJETIVOS)[number]["id"];

export const VERBAS = [
  { id: "ate-500", label: "Até R$ 500/mês", teto: 500 },
  { id: "500-1000", label: "R$ 500 a R$ 1.000/mês", teto: 1000 },
  { id: "1000-2000", label: "R$ 1.000 a R$ 2.000/mês", teto: 2000 },
  { id: "2000+", label: "Acima de R$ 2.000/mês", teto: Infinity },
] as const;
export type Verba = (typeof VERBAS)[number]["id"];

/** Segmento → quadro cujo público mais combina com ele (null = sem afinidade clara). */
export const SEGMENTOS: { label: string; quadro: string | null }[] = [
  { label: "Esporte / Academia / Crossfit", quadro: "pfc-esporte-clube" },
  { label: "Restaurante / Bar / Alimentação", quadro: "lado-a-lado-b" },
  { label: "Comércio / Loja", quadro: "lado-a-lado-b" },
  { label: "Imobiliária / Construção", quadro: "lado-a-lado-b" },
  { label: "Serviços / Consultoria / Agência", quadro: "papo-fora-da-caixa" },
  { label: "Indústria", quadro: "papo-fora-da-caixa" },
  { label: "Educação / Escola / Cursos", quadro: "pfc-news" },
  { label: "Tecnologia / Advocacia / Comunicação", quadro: "pfc-news" },
  { label: "Saúde / Clínica / Estética", quadro: null },
  { label: "Outro", quadro: null },
];

export type Briefing = {
  empresa: string;
  segmento: string;
  objetivos: Objetivo[];
  verba: Verba;
  exclusividade: boolean;
  /** Quadro que ele escolheu; vazio = deixa a gente sugerir. */
  quadro: string;
  /** Cor da marca (hex), só para os mockups. */
  cor?: string;
  /** @ do Instagram, sem o @ (vai no resumo para o comercial). */
  instagram?: string;
};

/** "@Marca", "instagram.com/marca/" ou "marca" → "marca"; null se não for um @ válido. */
export function handleInstagram(v: string): string | null {
  let s = v.trim();
  // Link do perfil, com ou sem https/www/m., e o encurtado instagr.am.
  const link = /^(?:https?:\/\/)?(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/(.*)$/i.exec(s);
  if (link) {
    // instagram.com/_u/marca (link de app) e caminhos que não são perfil.
    const partes = link[1].split(/[?#]/)[0].split("/").filter(Boolean);
    const p = partes[0] === "_u" ? partes[1] : partes[0];
    if (!p || ["p", "reel", "reels", "stories", "explore", "tv"].includes(p.toLowerCase())) return null;
    s = p;
  }
  // Espaço no meio é nome digitado, não @ ("box guacu" não pode virar "box").
  if (/\s/.test(s)) return null;
  const h = s.replace(/^@/, "").split(/[/?#]/)[0].toLowerCase();
  // Precisa de ao menos uma letra/número: "." ou "_" sozinhos não são @.
  return /^[a-z0-9._]{1,30}$/.test(h) && /[a-z0-9]/.test(h) ? h : null;
}

// ---------------------------------------------------------------- seleção

export const DURACOES = [1, 3, 6, 12] as const;
export type Meses = (typeof DURACOES)[number];

export type Selecao = {
  plano: string | null;
  /** Slugs de quadros com cota master. */
  quadros: string[];
  /** "slug:Modalidade" das cotas de apoio por modalidade. */
  modalidades: string[];
  visita: boolean;
  meses: Meses;
};

/** Quadros que ainda aceitam cota master (vendida sai da lista). */
export const quadrosComCota = (): Quadro[] =>
  quadros.filter((q) => q.cota && q.cota.status !== "vendida");

export const modalidadesLivres = () =>
  quadros.flatMap((q) =>
    (q.modalidades ?? [])
      .filter((m) => m.status !== "vendida")
      .map((m) => ({ key: `${q.slug}:${m.nome}`, quadro: q, nome: m.nome })),
  );

const quadroDoSegmento = (segmento: string) =>
  SEGMENTOS.find((s) => s.label === segmento)?.quadro ?? null;

export type Recomendacao = { selecao: Selecao; motivos: Record<string, string> };

/**
 * A sugestão inicial. Regras simples e explicáveis — cada item ligado vem com
 * o porquê, que aparece na tela. O visitante sempre pode mudar tudo depois.
 */
export function recomendar(b: Briefing): Recomendacao {
  const motivos: Record<string, string> = {};
  const quer = (o: Objetivo) => b.objetivos.includes(o);
  const disponiveis = new Set(quadrosComCota().map((q) => q.slug));

  // Quadro: o que ele escolheu, ou o do segmento se o objetivo pede foco.
  const quadroAlvo =
    (b.quadro && disponiveis.has(b.quadro) && b.quadro) ||
    ((quer("publico") || quer("autoridade")) && disponiveis.has(quadroDoSegmento(b.segmento) ?? "")
      ? quadroDoSegmento(b.segmento)
      : null);
  const nomeQuadro = quadros.find((q) => q.slug === quadroAlvo)?.name;

  let plano: string | null;
  let comQuadro = !!quadroAlvo;

  if (b.exclusividade) {
    plano = "master";
    motivos["plano:master"] = "Você pediu exclusividade: só o Master garante que nenhum concorrente do seu segmento anuncie junto.";
  } else if (b.verba === "ate-500") {
    plano = "apoio";
    comQuadro = false;
    motivos["plano:apoio"] = "Cabe na sua verba e coloca a marca no ar já no primeiro mês.";
  } else if (b.verba === "500-1000") {
    if (comQuadro) {
      plano = null;
      motivos[`quadro:${quadroAlvo}`] = `Com essa verba rende mais concentrar tudo em um quadro: o ${nomeQuadro} passa a ser apresentado pela sua marca.`;
    } else {
      plano = "patrocinador";
      motivos["plano:patrocinador"] = "Presença recorrente: logo no estúdio, menção nos episódios e cortes com a sua marca.";
    }
  } else {
    plano = b.verba === "2000+" ? "master" : "patrocinador";
    motivos[`plano:${plano}`] =
      plano === "master"
        ? "Sua verba permite a presença máxima: todos os episódios, menções ao vivo e relatório."
        : "Presença recorrente no canal todo, com espaço na verba para um quadro.";
  }

  if (comQuadro && quadroAlvo && !motivos[`quadro:${quadroAlvo}`]) {
    motivos[`quadro:${quadroAlvo}`] = b.quadro
      ? `Você escolheu o ${nomeQuadro}: a cota master coloca a sua marca como apresentadora do quadro.`
      : `O público do ${nomeQuadro} é o que mais combina com o seu segmento.`;
  }

  // Apoio por modalidade: esporte sem a cota master do quadro de esporte.
  const modalidades: string[] = [];
  if (quadroDoSegmento(b.segmento) === "pfc-esporte-clube" && !(comQuadro && quadroAlvo === "pfc-esporte-clube")) {
    // Só sugere a modalidade citada no segmento (crossfit → "Crossfit e Hyrox");
    // sem palavra em comum, deixa as modalidades desligadas para ele escolher.
    const seg = b.segmento.toLowerCase();
    const m = modalidadesLivres().find(
      (x) =>
        x.quadro.slug === "pfc-esporte-clube" &&
        x.nome
          .toLowerCase()
          .split(/\s+e\s+|,\s*/)
          .some((palavra) => palavra.length > 2 && seg.includes(palavra)),
    );
    if (m) {
      modalidades.push(m.key);
      motivos[`modalidade:${m.key}`] = "Sua marca aparece só nos episódios da modalidade que é a cara do seu negócio.";
    }
  }

  const visita = quer("vitrine") || quer("lancamento");
  if (visita) {
    motivos.visita = quer("lancamento")
      ? "Um episódio gravado no seu espaço é o jeito mais forte de anunciar uma novidade."
      : "A câmera vai até o seu negócio e você mostra o que faz no seu próprio ambiente.";
  }

  return {
    selecao: { plano, quadros: comQuadro && quadroAlvo ? [quadroAlvo] : [], modalidades, visita, meses: 3 },
    motivos,
  };
}

// ---------------------------------------------------------------- cálculo

export const VISITA_AVULSO = 1690;
/** Preço de cliente com plano ou cota ativa (já é desconto: só à vista). */
export const VISITA_CLIENTE = 1350;

export type Linha = {
  key: string;
  label: string;
  detalhe: string;
  /** null = sob consulta. */
  valor: number | null;
};

export type Orcamento = {
  linhas: Linha[];
  /** Soma dos itens com preço; os sob consulta ficam fora e entram em `sobConsulta`. */
  total: number;
  sobConsulta: string[];
  minMeses: number;
  meses: Meses;
  pagamento: string[];
  vazio: boolean;
};

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

/** Normaliza a seleção (descarta o que não existe mais, respeita o mínimo) e calcula. */
export function orcar(sel: Selecao): Orcamento {
  const plano = sel.plano ? planById(sel.plano) : undefined;
  const livres = new Set(quadrosComCota().map((q) => q.slug));
  const qs = sel.quadros.filter((s) => livres.has(s));
  const mods = modalidadesLivres().filter((m) => sel.modalidades.includes(m.key));

  const minMeses = qs.length || mods.length ? quadroSponsorship.minMonths : 1;
  const meses = (DURACOES.find((d) => d >= Math.max(sel.meses, minMeses)) ?? 12) as Meses;

  const linhas: Linha[] = [];
  const pagamento: string[] = [];

  if (plano) {
    const anual = meses === 12;
    linhas.push({
      key: `plano:${plano.id}`,
      label: `Plano ${plano.name}`,
      detalhe: anual
        ? `Anual com 20% off (economia de ${brl(plano.savings)})`
        : `${brl(plano.monthlyPrice)}/mês × ${meses} ${meses === 1 ? "mês" : "meses"}`,
      valor: anual ? plano.yearlyPrice : plano.monthlyPrice * meses,
    });
    pagamento.push(
      anual
        ? "Plano anual: Pix à vista ou até 3x sem juros no cartão."
        : "Plano: cobrança mensal no Pix ou cartão.",
    );
  }

  for (const slug of qs) {
    const q = quadros.find((x) => x.slug === slug)!;
    linhas.push({
      key: `quadro:${slug}`,
      label: `Cota Master · ${q.name}`,
      detalhe: `${brl(quadroSponsorship.master.monthlyPrice)}/mês × ${meses} meses${
        q.cota?.status === "negociacao" ? " · cota em negociação, sujeita a disponibilidade" : ""
      }`,
      valor: quadroSponsorship.master.monthlyPrice * meses,
    });
  }
  if (qs.length) pagamento.push("Cotas de quadro: cobrança mensal, contrato mínimo de 3 meses.");

  for (const m of mods) {
    linhas.push({
      key: `modalidade:${m.key}`,
      label: `Apoio ${m.nome} · ${m.quadro.name}`,
      detalhe: `Só nos episódios de ${m.nome.toLowerCase()} · ${meses} meses`,
      valor: null,
    });
  }

  if (sel.visita) {
    const cliente = !!plano || qs.length > 0;
    linhas.push({
      key: "visita",
      label: "PFC Visita",
      detalhe: cliente ? "Episódio no seu espaço · preço de cliente" : "Episódio no seu espaço · avulso",
      valor: cliente ? VISITA_CLIENTE : VISITA_AVULSO,
    });
    pagamento.push(
      cliente
        ? "PFC Visita com preço de cliente: à vista no Pix ou no cartão."
        : "PFC Visita avulso: Pix à vista ou até 3x sem juros.",
    );
  }

  const total = linhas.reduce((s, l) => s + (l.valor ?? 0), 0);
  return {
    linhas,
    total,
    sobConsulta: linhas.filter((l) => l.valor === null).map((l) => l.label),
    minMeses,
    meses,
    pagamento,
    vazio: linhas.length === 0,
  };
}

/** Texto do resumo que vai para o lead e para a mensagem de WhatsApp. */
export function resumo(b: Briefing, o: Orcamento): string {
  const obj = b.objetivos.map((id) => OBJETIVOS.find((x) => x.id === id)?.label).filter(Boolean).join(", ");
  const verba = VERBAS.find((v) => v.id === b.verba)?.label ?? b.verba;
  return [
    `Monte seu plano: ${b.empresa} (${b.segmento})`,
    ...(b.instagram ? [`Instagram: @${b.instagram}`] : []),
    `Objetivos: ${obj || "não informado"}`,
    `Verba: ${verba}${b.exclusividade ? " · quer exclusividade" : ""}`,
    `Duração: ${o.meses} ${o.meses === 1 ? "mês" : "meses"}`,
    "Itens:",
    ...o.linhas.map((l) => `- ${l.label}: ${l.valor === null ? "sob consulta" : brl(l.valor)}`),
    `Total estimado: ${brl(o.total)}${o.sobConsulta.length ? " + itens sob consulta" : ""}`,
  ].join("\n");
}

export { plans };
