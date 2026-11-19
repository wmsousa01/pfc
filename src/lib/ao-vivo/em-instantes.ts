import "server-only";
import { brtDate } from "@/lib/agenda/store";
import { download, db } from "@/lib/producao/store";
import { QUADROS, type QuadroId } from "@/lib/producao/quadros";
import { perfilDe } from "./instagram";

/**
 * Cena "Em instantes" do OBS, antes da live: a thumb do episódio, a contagem
 * até o horário marcado, o convidado e os parceiros do quadro. O link é o da
 * tela do quadro e troca de episódio sozinho.
 */

export type EmInstantes = {
  quadro: string;
  cor: string;
  inicio: string | null;
  /** Hora do servidor: o relógio do PC do estúdio pode estar errado. */
  agora: string;
  /** Há arte aprovada (a thumb sai por /ao-vivo/em-instantes/<token>/thumb). */
  temThumb: boolean;
  convidados: { nome: string; username: string | null; foto: string | null }[];
  parceiros: { nome: string; logo: string }[];
};

/** O episódio do quadro mais perto de agora, de 10 h antes a 14 h depois. */
export async function episodioDoDia(quadro: QuadroId) {
  const agora = Date.now();
  const { data } = await db()
    .from("agenda_episodios")
    .select("id, tema, inicio, arte_id")
    .eq("quadro", quadro)
    .neq("status", "cancelado")
    .gte("inicio", new Date(agora - 10 * 3600_000).toISOString())
    .lte("inicio", new Date(agora + 14 * 3600_000).toISOString());
  return (data ?? []).sort((a, b) => Math.abs(new Date(a.inicio).getTime() - agora) - Math.abs(new Date(b.inicio).getTime() - agora))[0] ?? null;
}

/** A thumb 16:9 da arte aprovada do episódio do dia. */
export async function thumbDoDia(quadro: QuadroId): Promise<Buffer | null> {
  const ep = await episodioDoDia(quadro);
  if (!ep?.arte_id) return null;
  const { data } = await db().from("agenda_artes").select("thumb_path").eq("id", ep.arte_id).maybeSingle();
  return data?.thumb_path ? download(data.thumb_path) : null;
}

export async function emInstantes(quadro: QuadroId): Promise<EmInstantes> {
  const ep = await episodioDoDia(quadro);
  const hoje = brtDate(new Date());
  const [{ data: cs }, { data: cotas }] = await Promise.all([
    ep
      ? db().from("agenda_convidados").select("nome, instagram, ig_perfil").eq("episodio_id", ep.id).order("created_at")
      : Promise.resolve({ data: [] as { nome: string; instagram: string | null; ig_perfil: { picture?: string | null } | null }[] }),
    db()
      .from("ao_vivo_cotas")
      .select("partner_id, inicio, fim, prioridade, parceiro:partners!inner(name, logo_url, active)")
      .eq("quadro", quadro)
      .eq("ativo", true)
      .eq("parceiro.active", true),
  ]);

  // Um logo por parceiro, os de maior cota primeiro.
  type Cota = { partner_id: string; inicio: string | null; fim: string | null; prioridade: number; parceiro: { name: string; logo_url: string | null } };
  const vistos = new Set<string>();
  const parceiros = ((cotas ?? []) as unknown as Cota[])
    .filter((c) => (!c.inicio || c.inicio <= hoje) && (!c.fim || c.fim >= hoje) && c.parceiro.logo_url)
    .sort((a, b) => b.prioridade - a.prioridade)
    .filter((c) => (vistos.has(c.partner_id) ? false : (vistos.add(c.partner_id), true)))
    .map((c) => ({ nome: c.parceiro.name, logo: c.parceiro.logo_url as string }));

  const convidados = await Promise.all(
    (cs ?? []).map(async (c) => {
      const user = c.instagram ? String(c.instagram) : null;
      // A foto guardada na agenda é uma URL temporária da CDN: a do perfil lido agora vale mais.
      const fresca = user ? await perfilDe(user, c.nome).then((p) => p.foto).catch(() => null) : null;
      return { nome: c.nome, username: user, foto: fresca ?? c.ig_perfil?.picture ?? null };
    })
  );

  return {
    quadro: QUADROS[quadro].name,
    cor: QUADROS[quadro].accent[1],
    inicio: ep?.inicio ?? null,
    agora: new Date().toISOString(),
    temThumb: !!ep?.arte_id,
    convidados,
    parceiros,
  };
}
