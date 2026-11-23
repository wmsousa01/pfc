import "server-only";
import { db } from "@/lib/producao/store";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";

export type MeuEpisodio = {
  id: string;
  quadro: string;
  quadroNome: string;
  inicio: string;
  status: string;
  tema: string | null;
  convidados: string[];
  espelhoToken: string | null;
};

export type MinhaArea = {
  nome: string;
  token: string;
  termoAceito: boolean;
  quadros: string[];
  episodios: MeuEpisodio[];
};

/**
 * O que o apresentador logado vê em /admin/meus-quadros: os quadros em que
 * ele está e os episódios dos próximos 60 dias (e da última semana) em que
 * participa. Episódio sem escolha de apresentadores conta com todos os ativos
 * do quadro, igual a apresentadoresDoEpisodio().
 */
export async function minhaArea(cadastroId: string): Promise<MinhaArea | null> {
  const { data: cad } = await db()
    .from("apresentadores_cadastros")
    .select("nome, token, termo_aceito_em, termo_revogado_em")
    .eq("id", cadastroId)
    .maybeSingle();
  if (!cad) return null;

  const { data: linhas } = await db().from("agenda_apresentadores").select("id, quadro, ativo").eq("cadastro_id", cadastroId);
  const minhas = (linhas ?? []) as { id: string; quadro: string; ativo: boolean }[];
  const quadros = Array.from(new Set(minhas.filter((l) => l.ativo).map((l) => l.quadro)));
  const ids = new Set(minhas.map((l) => l.id));
  const ativoNo = new Set(minhas.filter((l) => l.ativo).map((l) => l.quadro));

  const base = {
    nome: cad.nome as string,
    token: cad.token as string,
    termoAceito: !!cad.termo_aceito_em && !cad.termo_revogado_em,
    quadros: quadros.map((q) => (isQuadroId(q) ? QUADROS[q].name : q)),
  };
  const todosQuadros = Array.from(new Set(minhas.map((l) => l.quadro)));
  if (todosQuadros.length === 0) return { ...base, episodios: [] };

  const desde = new Date(Date.now() - 7 * 864e5).toISOString();
  const ate = new Date(Date.now() + 60 * 864e5).toISOString();
  const { data: eps } = await db()
    .from("agenda_episodios")
    .select("id, quadro, inicio, status, tema, apresentadores, espelho_token")
    .in("quadro", todosQuadros)
    .neq("status", "cancelado")
    .gte("inicio", desde)
    .lte("inicio", ate)
    .order("inicio");

  type Ep = { id: string; quadro: string; inicio: string; status: string; tema: string | null; apresentadores: string[] | null; espelho_token: string | null };
  const meus = ((eps ?? []) as Ep[]).filter((e) =>
    e.apresentadores ? e.apresentadores.some((a) => ids.has(a)) : ativoNo.has(e.quadro)
  );

  const convidadosPor = new Map<string, string[]>();
  if (meus.length) {
    const { data: cs } = await db()
      .from("agenda_convidados")
      .select("episodio_id, nome")
      .in("episodio_id", meus.map((e) => e.id));
    for (const c of (cs ?? []) as { episodio_id: string; nome: string }[]) {
      convidadosPor.set(c.episodio_id, [...(convidadosPor.get(c.episodio_id) ?? []), c.nome]);
    }
  }

  return {
    ...base,
    episodios: meus.map((e) => ({
      id: e.id,
      quadro: e.quadro,
      quadroNome: isQuadroId(e.quadro) ? QUADROS[e.quadro].name : e.quadro,
      inicio: e.inicio,
      status: e.status,
      tema: e.tema,
      convidados: convidadosPor.get(e.id) ?? [],
      espelhoToken: e.espelho_token,
    })),
  };
}
