import "server-only";
import { BUCKET } from "@/lib/producao/store";
import { codigoDoPost } from "./espelho";
import { escreverMateriaExtra } from "./noticias";
import { baixarImagem, lerPagina } from "./sites";
import { db, getEpisodio, logAgenda, materiaisDe, updateEpisodio, type Briefing, type Episodio, type Extra } from "./store";

/**
 * Notícia avulsa de outra fonte (um portal, a EPTV, um release que chegou
 * no WhatsApp) que a equipe põe no roteiro já pronto: a IA escreve a
 * matéria no formato do apresentador e ela entra na posição escolhida, com
 * a foto da página quando houver. Fica guardada no roteiro e volta,
 * obrigatória, quando a pauta é gerada de novo.
 */

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** Briefing mínimo para um roteiro que veio só do apresentador: é nele que fica o crédito do GC. */
const briefingVazio = (): Briefing => ({
  resumo: "",
  pauta: [],
  cuidados: "",
  titulo_live: "",
  descricao_yt: "",
  legenda_ig: "",
  arte: { l1: "", l2: "" },
});

/**
 * Abre espaço para uma matéria em `pos` (delta 1) ou fecha o da que saiu
 * (delta -1): as imagens e o bloco no ar andam junto, para nada trocar de
 * lugar no espelho com o programa no ar.
 */
async function deslocar(ep: Episodio, pos: number, delta: 1 | -1): Promise<number | null> {
  for (const m of await materiaisDe(ep.id)) {
    if (m.bloco == null || m.bloco < pos) continue;
    const novo = delta < 0 && m.bloco === pos ? null : m.bloco + delta;
    await db().from("agenda_materiais").update({ bloco: novo }).eq("id", m.id);
  }
  const a = ep.espelho_atual;
  if (a == null || a < pos) return a;
  return delta < 0 && a === pos ? Math.max(0, pos - 1) : a + delta;
}

export async function adicionarExtra(
  epId: string,
  dados: { url: string | null; fonte: string | null; texto: string | null; posicao: number | null },
  actor: string
): Promise<string> {
  const ep = await getEpisodio(epId);
  if (!ep) throw new Error("Episódio não encontrado.");
  if (!dados.url && !dados.texto) throw new Error("Cole o link ou o texto da notícia.");

  let url: string | null = null;
  if (dados.url) {
    try {
      url = new URL(dados.url.trim()).toString();
    } catch {
      throw new Error("Link inválido.");
    }
  }
  let lida: Awaited<ReturnType<typeof lerPagina>> | null = null;
  if (url) {
    try {
      lida = await lerPagina(url);
    } catch (e) {
      if (!dados.texto) throw new Error(`Não deu para ler o link (${msg(e)}). Cole o texto da notícia junto.`);
    }
  }
  const texto = [lida?.titulo, dados.texto?.trim(), lida?.texto].filter(Boolean).join("\n\n");
  if (texto.length < 80) throw new Error("O link não trouxe o texto da notícia. Cole o texto junto.");
  const fonte = dados.fonte?.trim() || (url ? new URL(url).hostname.replace(/^www\./, "") : "Equipe PFC");

  // Antes da pauta: só guarda. A geração lê as extras e escreve a matéria junto com as outras.
  if (!ep.roteiro?.materias.length) {
    const titulo = (lida?.titulo || texto.split("\n")[0]).slice(0, 120);
    const guardada: Extra = { fonte, url, texto: texto.slice(0, 8000), imagem: lida?.imagem ?? null, materia: titulo, adicionada_em: new Date().toISOString(), por: actor };
    const base = ep.roteiro ?? { arquivo: null, importado_em: guardada.adicionada_em, origem: "ia" as const, materias: [] };
    await updateEpisodio(ep.id, { roteiro: { ...base, extras: [...(base.extras ?? []), guardada] } });
    await logAgenda(ep.id, actor, "guardou notícia de outra fonte para a pauta", `${titulo} (${fonte})`);
    return titulo;
  }

  const materias = [...ep.roteiro.materias];
  const fim = materias.findIndex((m) => m.tipo === "encerramento");
  // Sem posição: logo antes do encerramento. A abertura fica sempre em primeiro.
  const pos = Math.min(Math.max(1, dados.posicao ?? (fim >= 0 ? fim : materias.length)), materias.length);
  const vizinha = materias[pos - 1] ?? materias[0];
  const mat = await escreverMateriaExtra(texto, fonte, vizinha?.bloco ?? null);
  // Dois títulos iguais confundiriam o GC e as fotos.
  if (materias.some((m) => m.titulo === mat.titulo)) mat.titulo = `${mat.titulo} (${fonte})`;
  materias.splice(pos, 0, mat);

  const extra: Extra = {
    fonte,
    url,
    texto: texto.slice(0, 8000),
    imagem: lida?.imagem ?? null,
    materia: mat.titulo,
    adicionada_em: new Date().toISOString(),
    por: actor,
  };
  const briefing = ep.briefing ?? briefingVazio();
  const noticias = [
    ...(briefing.noticias ?? []),
    {
      titulo: mat.titulo,
      resumo: (mat.leitura ?? "").split("\n\n")[0].slice(0, 400),
      fontes: [{ handle: fonte, url: url ?? "", data: extra.adicionada_em, rotulo: fonte }],
    },
  ];
  const atual = await deslocar(ep, pos, 1);
  await updateEpisodio(ep.id, {
    roteiro: { ...ep.roteiro, materias, extras: [...(ep.roteiro.extras ?? []), extra] },
    briefing: { ...briefing, noticias },
    espelho_atual: atual,
  });

  // A foto da página vai para o bloco novo; "pauta-news" para a próxima geração refazer junto com as outras.
  if (extra.imagem) {
    try {
      const img = await baixarImagem(extra.imagem);
      if (img) {
        const ext = img.mime === "image/png" ? "png" : img.mime === "image/webp" ? "webp" : "jpg";
        const nome = `${fonte.replace(/[^\w.-]+/g, "-")}-${(url && codigoDoPost(url)) ?? Date.now()}.${ext}`;
        const path = `agenda/${ep.id}/materiais/news-${nome}`;
        const { error } = await db().storage.from(BUCKET).upload(path, img.buf, { contentType: img.mime, upsert: true });
        if (!error) {
          await db().from("agenda_materiais").insert({
            episodio_id: ep.id,
            tipo: "outro",
            path,
            nome,
            mime: img.mime,
            tamanho: img.buf.length,
            usar_na_arte: false,
            bloco: pos,
            enviado_por: "pauta-news",
          });
        }
      }
    } catch {
      // Sem a foto, a matéria entra do mesmo jeito.
    }
  }
  await logAgenda(ep.id, actor, "pôs notícia de outra fonte no roteiro", `${mat.titulo} (${fonte}), bloco ${pos + 1}`);
  return mat.titulo;
}

/** Tira a notícia extra e a matéria que saiu dela. */
export async function removerExtra(epId: string, indice: number, actor: string): Promise<void> {
  const ep = await getEpisodio(epId);
  const extra = ep?.roteiro?.extras?.[indice];
  if (!ep?.roteiro || !extra) return;
  // Guardada antes da pauta: ainda não virou matéria.
  const pos = ep.roteiro.materias.length ? ep.roteiro.materias.findIndex((m) => m.titulo === extra.materia) : -1;
  const materias = ep.roteiro.materias.filter((_, i) => i !== pos);
  const atual = pos >= 0 ? await deslocar(ep, pos, -1) : ep.espelho_atual;
  await updateEpisodio(ep.id, {
    roteiro: { ...ep.roteiro, materias, extras: ep.roteiro.extras!.filter((_, i) => i !== indice) },
    ...(ep.briefing ? { briefing: { ...ep.briefing, noticias: (ep.briefing.noticias ?? []).filter((n) => n.titulo !== extra.materia) } } : {}),
    espelho_atual: atual,
  });
  await logAgenda(ep.id, actor, "tirou notícia de outra fonte do roteiro", `${extra.materia} (${extra.fonte})`);
}
