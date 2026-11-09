import "server-only";
import { CAMPOS, isCampo, type Campo } from "./campos";
import { episodioPorEspelho } from "./espelho";
import { db, getEpisodio, logAgenda, updateEpisodio, type Materia } from "./store";

/**
 * Revisão do roteiro pelo link (/roteiro/<token do espelho>): quem tem o
 * link sugere edição em cada parte de uma matéria ou deixa um comentário
 * geral nela; a produção aceita ou recusa no admin. Aceita, a proposta
 * entra no roteiro (e no espelho, que recarrega sozinho).
 */

export { CAMPOS, type Campo };

export type Sugestao = {
  id: string;
  episodio_id: string;
  materia: string;
  campo: Campo;
  original: string | null;
  proposta: string | null;
  comentario: string | null;
  autor: string;
  status: "aberta" | "aceita" | "recusada";
  decidida_por: string | null;
  decidida_em: string | null;
  created_at: string;
};

/** O texto de uma parte da matéria como aparece para editar (tópicos um por linha). */
export function valorDoCampo(m: Materia, campo: Campo): string | null {
  if (campo === "geral") return null;
  if (campo === "pontos") return m.pontos.length ? m.pontos.join("\n") : null;
  return m[campo];
}

export async function sugestoesDe(epId: string): Promise<Sugestao[]> {
  const { data } = await db().from("agenda_sugestoes").select("*").eq("episodio_id", epId).order("created_at");
  return (data ?? []) as Sugestao[];
}

/** Teto de sugestões em aberto por episódio: o link é público, isso segura spam. */
const MAX_ABERTAS = 300;

const corte = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, n) : "") || null;

export async function sugerir(
  token: string,
  dados: { materia: unknown; campo: unknown; proposta: unknown; comentario: unknown; autor: unknown }
): Promise<void> {
  const ep = await episodioPorEspelho(token);
  if (!ep) throw new Error("Link inválido.");
  const autor = corte(dados.autor, 60);
  if (!autor) throw new Error("Escreva seu nome para a produção saber de quem é a sugestão.");
  const campo = typeof dados.campo === "string" && isCampo(dados.campo) ? dados.campo : null;
  if (!campo) throw new Error("Parte da matéria inválida.");
  const m = ep.roteiro?.materias.find((x) => x.titulo === dados.materia);
  if (!m) throw new Error("Essa matéria não está mais no roteiro. Recarregue a página.");

  const original = valorDoCampo(m, campo);
  let proposta = campo === "geral" ? null : corte(dados.proposta, 12_000);
  // Proposta igual ao texto atual não é edição: fica só o comentário.
  if (proposta !== null && proposta === (original ?? "").trim()) proposta = null;
  const comentario = corte(dados.comentario, 2_000);
  if (!proposta && !comentario) throw new Error("Mude o texto ou escreva um comentário.");

  const { count } = await db().from("agenda_sugestoes").select("id", { count: "exact", head: true }).eq("episodio_id", ep.id).eq("status", "aberta");
  if ((count ?? 0) >= MAX_ABERTAS) throw new Error("Muitas sugestões em aberto neste episódio. Peça para a produção revisar as que já estão lá.");

  const { error } = await db().from("agenda_sugestoes").insert({ episodio_id: ep.id, materia: m.titulo, campo, original, proposta, comentario, autor });
  if (error) throw new Error(error.message);
  await logAgenda(ep.id, autor, proposta ? "sugeriu edição no roteiro" : "comentou no roteiro", `${m.titulo} · ${CAMPOS[campo]}`);
}

/** Aplica a proposta no campo da matéria: tópicos voltam a ser lista, sem o marcador. */
function aplicar(m: Materia, campo: Campo, proposta: string): Materia {
  if (campo === "geral") return m;
  if (campo === "pontos") {
    return { ...m, pontos: proposta.split("\n").map((l) => l.replace(/^\s*[-*•●]\s*/, "").trim()).filter(Boolean) };
  }
  return { ...m, [campo]: proposta.trim() || null };
}

/**
 * Aceita (e aplica) ou recusa. Aceitar uma edição marca o roteiro como
 * "editado": gerar a pauta de novo não passa por cima do que a equipe ajustou.
 */
export async function decidir(id: string, aceitar: boolean, actor: string): Promise<void> {
  const { data } = await db().from("agenda_sugestoes").select("*").eq("id", id).maybeSingle();
  const s = data as Sugestao | null;
  if (!s || s.status !== "aberta") return;
  const ep = await getEpisodio(s.episodio_id);
  if (!ep) throw new Error("Episódio não encontrado.");

  if (aceitar && s.proposta !== null) {
    const materias = ep.roteiro?.materias ?? [];
    const i = materias.findIndex((m) => m.titulo === s.materia);
    if (i < 0) throw new Error(`A matéria "${s.materia}" não está mais no roteiro: recuse a sugestão ou aplique à mão.`);
    const novas = materias.map((m, k) => (k === i ? aplicar(m, s.campo, s.proposta!) : m));
    await updateEpisodio(ep.id, { roteiro: { ...ep.roteiro!, materias: novas, origem: ep.roteiro!.origem === "ia" ? "editado" : ep.roteiro!.origem } });
  }
  const { error } = await db()
    .from("agenda_sugestoes")
    .update({ status: aceitar ? "aceita" : "recusada", decidida_por: actor, decidida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "aberta");
  if (error) throw new Error(error.message);
  await logAgenda(ep.id, actor, aceitar ? "aceitou sugestão no roteiro" : "recusou sugestão no roteiro", `${s.materia} · ${CAMPOS[s.campo]} (de ${s.autor})`);
}
