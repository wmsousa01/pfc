import type { Briefing } from "./store";

type Noticia = NonNullable<Briefing["noticias"]>[number];

/** Palavras que aparecem em quase toda notícia da região e não dizem de qual assunto é. */
const COMUNS = new Set(
  (
    "quais qual como para pela pelo pelos pelas apos mais menos esse essa isso nesse nessa desta deste sobre entre " +
    "onde quando quem pode podem deve devem foram sera ainda antes depois muito tambem cada todo toda nova novo " +
    "mogi guacu mirim estiva gerbi itapira regiao regional cidade municipal municipio prefeitura semana paulo"
  ).split(" ")
);

/** Plural simples do português ("policiais" → "policial", "ações" → "acao", "rodovias" → "rodovia"). */
function singular(w: string): string {
  if (/(oes|aes)$/.test(w)) return `${w.slice(0, -3)}ao`;
  if (w.endsWith("ais")) return `${w.slice(0, -3)}al`;
  if (w.endsWith("eis")) return `${w.slice(0, -3)}el`;
  if (w.endsWith("ns")) return `${w.slice(0, -2)}m`;
  if (w.endsWith("s") && w.length > 4) return w.slice(0, -1);
  return w;
}

function palavras(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/)) {
    const v = singular(w);
    // Número curto ("30") e palavra de até 3 letras não distinguem assunto; "340" (rodovia) distingue.
    if (v.length >= 4 || /^\d{3,}$/.test(v)) if (!COMUNS.has(v)) out.add(v);
  }
  return out;
}

const comuns = (a: Set<string>, b: Set<string>) => Array.from(a).filter((w) => b.has(w)).length;

/**
 * Em que bloco da pauta entra cada notícia (índice na pauta; -1 = nenhum).
 * A IA às vezes junta várias notícias num bloco e dá a ele outro título
 * ("Ocorrências de Trânsito e Ações Policiais"), e a equipe edita a pauta:
 * vale o título igual e, senão, o bloco com mais palavras em comum entre a
 * notícia e o título e os pontos do bloco. Empate fica com quem tem mais
 * palavras em comum só no título, depois com o primeiro.
 *
 * `minimo`: parte das palavras da notícia que precisa aparecer no bloco
 * para casar. No roteiro do apresentador nem toda notícia da pauta entra,
 * e uma notícia de rodovia não pode cair na matéria da concessão só por
 * dividir "rodovia" e "trecho".
 */
export function casarNoticias(pauta: Briefing["pauta"], noticias: Noticia[], minimo = 0): number[] {
  const blocos = pauta.map((p) => ({ titulo: palavras(p.bloco), tudo: palavras([p.bloco, ...p.perguntas].join(" ")) }));
  return noticias.map((n) => {
    const titulo = palavras(n.titulo);
    const exato = pauta.findIndex((p) => {
      const t = palavras(p.bloco);
      return t.size > 0 && t.size === titulo.size && comuns(t, titulo) === t.size;
    });
    if (exato >= 0) return exato;
    const tudo = palavras(`${n.titulo} ${n.resumo}`);
    let melhor = -1;
    let nota = [0, 0];
    blocos.forEach((b, i) => {
      const s = [comuns(tudo, b.tudo), comuns(tudo, b.titulo)];
      if (s[0] > nota[0] || (s[0] === nota[0] && s[0] > 0 && s[1] > nota[1])) {
        melhor = i;
        nota = s;
      }
    });
    return melhor >= 0 && nota[0] >= minimo * tudo.size ? melhor : -1;
  });
}
