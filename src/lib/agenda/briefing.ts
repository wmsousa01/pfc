import "server-only";
import { TEXT_MODEL, generate } from "@/lib/producao/gemini";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { quandoLongo, type Apresentador, type Briefing, type Convidado, type Episodio } from "./store";

function sobre(c: Convidado): string {
  const ig = c.ig_perfil && !c.ig_perfil.erro ? c.ig_perfil : null;
  return [
    `Nome: ${c.nome}`,
    c.cargo && `Como quer ser apresentado: ${c.cargo}`,
    c.instagram && `Instagram: @${c.instagram}${ig?.followers ? ` (${ig.followers} seguidores)` : ""}`,
    ig?.biography && `Bio do Instagram: ${ig.biography}`,
    c.bio && `Quem é (escrito pelo convidado): ${c.bio}`,
    c.temas && `Temas que quer abordar: ${c.temas}`,
    c.divulgar && `O que quer divulgar: ${c.divulgar}`,
    c.links && `Links: ${c.links}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const STR = { type: "STRING" } as const;

/**
 * Briefing do apresentador e os textos de divulgação, a partir do que o
 * convidado escreveu. A equipe revisa e edita antes de usar: o modelo não
 * conhece o convidado além disso.
 */
export async function gerarBriefing(ep: Episodio, convidados: Convidado[], hosts: Apresentador[] = []): Promise<Briefing> {
  const quadro = isQuadroId(ep.quadro) ? QUADROS[ep.quadro].name : ep.quadro;
  const handles = convidados.filter((c) => c.instagram).map((c) => `@${c.instagram}`);
  const apresenta = hosts.length ? `\nApresentação: ${hosts.map((h) => h.nome).join(" e ")}.` : "";
  // PFC News e afins: sem convidado, o episódio é o apresentador e o tema da semana.
  const semConvidado = convidados.length === 0;
  const pessoas = semConvidado
    ? "Sem convidado: o episódio é o apresentador conduzindo o tema da semana."
    : `Convidado(s):\n${convidados.map(sobre).join("\n\n")}`;
  const prompt = `Você é produtor do podcast "${quadro}", do Fora da Caixa (Mogi Guaçu, SP), gravado ao vivo no YouTube.
Episódio: ${quandoLongo(ep.inicio)}, cerca de ${ep.duracao_min} minutos.${apresenta}${ep.tema ? `\nTema definido pela equipe: ${ep.tema}` : ""}

${pessoas}

Prepare, em português do Brasil:
${
  semConvidado
    ? `- resumo: abertura do programa em 3 a 5 frases sobre o tema da semana. Não invente fatos, números nem notícias.
- pauta: 4 a 5 blocos na ordem do programa (abertura, os assuntos do tema, participação do público, fechamento), com 2 a 4 pontos curtos em cada bloco.`
    : `- resumo: quem é o convidado em 3 a 5 frases, para o apresentador abrir o programa. Só fatos que estão acima; não invente cargo, número nem história.
- pauta: 4 a 5 blocos na ordem da conversa (abertura, trajetória, os temas dele, o que ele divulga, fechamento), com 2 a 4 perguntas abertas e curtas em cada bloco.`
}
- cuidados: o que evitar ou tratar com cuidado (temas sensíveis, promessas, termos técnicos a explicar). Uma ou duas frases; vazio se não houver.
- titulo_live: título da live no YouTube, até 90 caracteres, ${semConvidado ? "com o gancho do tema" : "com o nome do convidado e o gancho do tema"}, sem caixa alta inteira e sem emoji.
- descricao_yt: descrição da live, 3 parágrafos curtos: o que vai rolar, ${semConvidado ? "por que o tema importa para a região" : `quem é o convidado (com ${handles.join(", ") || "o @ dele, se houver"})`}, e o convite para assistir ao vivo e mandar perguntas no chat.
- legenda_ig: legenda do post de divulgação no Instagram: gancho na primeira linha, data e horário (${quandoLongo(ep.inicio)}), "ao vivo no YouTube, link na bio", ${semConvidado ? "" : `marque ${handles.join(" ") || "o convidado"}, `}e termine com 3 a 5 hashtags incluindo #ForaDaCaixa e #MogiGuaçu.
- arte: a arte de divulgação.
  - l1, l2, l3: headline em MAIÚSCULAS, frase só quebrada em linhas: l1 até 4 palavras (gancho, sai menor), l2 até 2 palavras (destaque colorido), l3 até 2 palavras (complemento; vazio se não precisar). Sobre o TEMA, não o nome. Ex.: "POR TRÁS DA FARDA" / "UMA PARCERIA" / "DE CONFIANÇA".
  - topicos: 3 ou 4 palavras-chave do tema separadas por " • ", em MAIÚSCULAS (ex.: "DISCIPLINA • TREINAMENTO • SEGURANÇA PÚBLICA").
  - sub: frase curta de apoio em MAIÚSCULAS, até 8 palavras; vazio se não somar.
  - cena: em uma ou duas frases, os elementos do cenário que combinam com o tema, para o fundo da arte (ex.: "viatura e escudo do canil da guarda municipal, à noite"; "interfaces digitais, gráficos de crescimento e contratos sobre a mesa"). Nada de pessoas nem texto.`;

  const json = await generate(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          resumo: STR,
          pauta: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { bloco: STR, perguntas: { type: "ARRAY", items: STR } },
              required: ["bloco", "perguntas"],
            },
          },
          cuidados: STR,
          titulo_live: STR,
          descricao_yt: STR,
          legenda_ig: STR,
          arte: {
            type: "OBJECT",
            properties: { l1: STR, l2: STR, l3: STR, topicos: STR, sub: STR, cena: STR },
            required: ["l1", "l2", "topicos", "cena"],
          },
        },
        required: ["resumo", "pauta", "titulo_live", "descricao_yt", "legenda_ig", "arte"],
      },
    },
  });
  const b = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as Partial<Briefing>;
  if (!b.resumo || !b.arte?.l1) throw new Error("O Gemini não devolveu o briefing.");
  const up = (v?: string) => (v ?? "").trim().toUpperCase();
  return {
    resumo: b.resumo.trim(),
    pauta: (b.pauta ?? []).filter((p) => p.bloco && p.perguntas?.length),
    cuidados: (b.cuidados ?? "").trim(),
    titulo_live: (b.titulo_live ?? "").trim().slice(0, 100),
    descricao_yt: (b.descricao_yt ?? "").trim(),
    legenda_ig: (b.legenda_ig ?? "").trim(),
    arte: {
      l1: up(b.arte.l1),
      l2: up(b.arte.l2),
      ...(up(b.arte.l3) ? { l3: up(b.arte.l3) } : {}),
      ...(up(b.arte.topicos) ? { topicos: up(b.arte.topicos) } : {}),
      ...(up(b.arte.sub) ? { sub: up(b.arte.sub) } : {}),
      ...(b.arte.cena?.trim() ? { cena: b.arte.cena.trim() } : {}),
    },
  };
}

/** Pauta em texto corrido, para editar numa caixa só. */
export function pautaTexto(p: Briefing["pauta"]): string {
  return p.map((b) => [`## ${b.bloco}`, ...b.perguntas.map((q) => `- ${q}`)].join("\n")).join("\n\n");
}

export function pautaDeTexto(t: string): Briefing["pauta"] {
  const out: Briefing["pauta"] = [];
  for (const line of t.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith("#")) out.push({ bloco: l.replace(/^#+\s*/, ""), perguntas: [] });
    else {
      if (out.length === 0) out.push({ bloco: "Conversa", perguntas: [] });
      out[out.length - 1].perguntas.push(l.replace(/^[-*•]\s*/, ""));
    }
  }
  return out;
}
