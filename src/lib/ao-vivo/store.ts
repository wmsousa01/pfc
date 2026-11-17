import "server-only";
import { randomBytes, randomUUID } from "crypto";
import QRCode from "qrcode";
import { brtDate } from "@/lib/agenda/store";
import { quadros as quadrosSite, site } from "@/lib/config";
import { BUCKET, db } from "@/lib/producao/store";
import { QUADROS, QUADRO_IDS, isQuadroId, type QuadroId } from "@/lib/producao/quadros";
import { trackingUrl } from "@/lib/qr";
import { montarFila, type CotaPlano } from "./plano";
import type {
  EstadoRegie,
  EstadoTela,
  ItemFila,
  ItemTela,
  Momento,
  Posicao,
  StatusInsercao,
  StatusSessao,
  TipoInsercao,
} from "./tipos";

/**
 * Inserções dos patrocinadores na live. A tela do OBS e a régie consultam a
 * cada segundo; cada consulta roda o relógio (ao_vivo_avancar, no banco) e
 * devolve o estado. Sem live no ar, a tela fica transparente.
 */

// ---------------------------------------------------------------- tipos do banco

export type Cota = {
  id: string;
  partner_id: string;
  quadro: string;
  modalidade: string | null;
  tipo: TipoInsercao;
  momento: Momento;
  duracao_s: number;
  vezes: number | null;
  a_cada_min: number | null;
  texto: string | null;
  midia_path: string | null;
  midia_mime: string | null;
  posicao: Posicao;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
  prioridade: number;
  observacao: string | null;
  created_at: string;
};

export type Sessao = {
  id: string;
  quadro: string;
  modalidade: string | null;
  episodio_id: string | null;
  titulo: string | null;
  status: StatusSessao;
  duracao_prevista_min: number;
  iniciada_em: string;
  encerrada_em: string | null;
  segurando: boolean;
  iniciada_por: string | null;
};

type Insercao = {
  id: string;
  sessao_id: string;
  cota_id: string | null;
  partner_id: string | null;
  tipo: TipoInsercao;
  momento: Momento;
  previsto_s: number | null;
  duracao_s: number;
  prioridade: number;
  status: StatusInsercao;
  inicio_em: string | null;
  fim_em: string | null;
  disparo: "auto" | "manual" | null;
};

type ParceiroMin = { id: string; slug: string; name: string; logo_url: string | null; accent: string | null; active: boolean };

/** Respiro entre duas inserções de destaque (faixa, QR, vinheta). */
const GAP_S = 15;

const nomeQuadro = (q: string) => (isQuadroId(q) ? QUADROS[q].name : q);

/** Modalidades do quadro (PFC Esporte Clube), do config do site. */
export function modalidadesDo(q: string): string[] {
  return quadrosSite.find((x) => x.slug === q)?.modalidades?.map((m) => m.nome) ?? [];
}

// ---------------------------------------------------------------- links por quadro

export type Tela = { quadro: QuadroId; token_tela: string; token_regie: string };

const novoToken = () => randomBytes(12).toString("base64url");

/** Um par de links por quadro (tela do OBS e régie). Cria os que faltam. */
export async function garantirTelas(): Promise<Tela[]> {
  const { data } = await db().from("ao_vivo_telas").select("quadro, token_tela, token_regie");
  const tem = new Set((data ?? []).map((t) => t.quadro));
  const faltam = QUADRO_IDS.filter((q) => !tem.has(q)).map((quadro) => ({
    quadro,
    token_tela: novoToken(),
    token_regie: novoToken(),
  }));
  if (faltam.length) {
    const { error } = await db().from("ao_vivo_telas").upsert(faltam, { onConflict: "quadro", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return garantirTelas();
  }
  return ((data ?? []) as Tela[]).filter((t) => isQuadroId(t.quadro));
}

/** Troca os dois links do quadro (quando um vazou). A cena do OBS precisa da URL nova. */
export async function trocarLinks(quadro: QuadroId): Promise<void> {
  const { error } = await db()
    .from("ao_vivo_telas")
    .update({ token_tela: novoToken(), token_regie: novoToken() })
    .eq("quadro", quadro);
  if (error) throw new Error(error.message);
}

async function quadroPor(coluna: "token_tela" | "token_regie", token: string): Promise<QuadroId | null> {
  if (!token || token.length > 64) return null;
  const { data } = await db().from("ao_vivo_telas").select("quadro").eq(coluna, token).maybeSingle();
  return data && isQuadroId(data.quadro) ? data.quadro : null;
}
export const quadroDaTela = (token: string) => quadroPor("token_tela", token);
export const quadroDaRegie = (token: string) => quadroPor("token_regie", token);

// ---------------------------------------------------------------- cotas

export async function listCotas(): Promise<(Cota & { parceiro: ParceiroMin | null })[]> {
  const { data, error } = await db()
    .from("ao_vivo_cotas")
    .select("*, parceiro:partners(id, slug, name, logo_url, accent, active)")
    .order("quadro")
    .order("prioridade", { ascending: false })
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as (Cota & { parceiro: ParceiroMin | null })[];
}

export async function getCota(id: string): Promise<Cota | null> {
  const { data } = await db().from("ao_vivo_cotas").select("*").eq("id", id).maybeSingle();
  return (data as Cota | null) ?? null;
}

export type CotaInput = Omit<Cota, "id" | "created_at">;

export async function salvarCota(id: string | null, c: CotaInput): Promise<void> {
  const q = id
    ? db().from("ao_vivo_cotas").update(c).eq("id", id)
    : db().from("ao_vivo_cotas").insert(c);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function alternarCota(id: string, ativo: boolean): Promise<void> {
  const { error } = await db().from("ao_vivo_cotas").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function apagarCota(id: string): Promise<void> {
  const cota = await getCota(id);
  const { error } = await db().from("ao_vivo_cotas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (cota?.midia_path) await db().storage.from(BUCKET).remove([cota.midia_path]);
}

const MAX_MIDIA = 50 * 1024 * 1024;

/** URL assinada para o navegador subir a vinheta ou a arte (passa do limite de 4,5 MB da Vercel). */
export async function pedirUploadMidia(nome: string, mime: string, tamanho: number): Promise<{ path: string; token: string }> {
  if (!/^(image|video)\//.test(mime)) throw new Error("Mande vídeo ou imagem.");
  if (tamanho > MAX_MIDIA) throw new Error("Arquivo acima de 50 MB.");
  const ext = (nome.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "").toLowerCase();
  const path = `ao-vivo/${randomUUID()}${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Storage: ${error?.message ?? "sem URL"}`);
  return { path, token: data.token };
}

/** Cotas que valem hoje para a live do quadro (e da modalidade, se houver). */
async function cotasDaLive(quadro: string, modalidade: string | null): Promise<Cota[]> {
  const hoje = brtDate(new Date());
  const { data, error } = await db()
    .from("ao_vivo_cotas")
    .select("*, parceiro:partners!inner(active)")
    .eq("quadro", quadro)
    .eq("ativo", true)
    .eq("parceiro.active", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Cota[]).filter(
    (c) =>
      (!c.inicio || c.inicio <= hoje) &&
      (!c.fim || c.fim >= hoje) &&
      (c.modalidade === null || c.modalidade === modalidade)
  );
}

const paraPlano = (c: Cota): CotaPlano => ({
  id: c.id,
  partner_id: c.partner_id,
  tipo: c.tipo,
  momento: c.momento,
  duracao_s: c.duracao_s,
  vezes: c.vezes,
  a_cada_min: c.a_cada_min,
  prioridade: c.prioridade,
});

// ---------------------------------------------------------------- sessão

export async function sessaoAtiva(quadro: string): Promise<Sessao | null> {
  const { data } = await db()
    .from("ao_vivo_sessoes")
    .select("*")
    .eq("quadro", quadro)
    .neq("status", "encerrada")
    .maybeSingle();
  return (data as Sessao | null) ?? null;
}

export async function iniciarSessao(
  quadro: QuadroId,
  o: { modalidade: string | null; episodio_id: string | null; duracao_min: number; titulo: string | null; por: string }
): Promise<Sessao> {
  if (await sessaoAtiva(quadro)) throw new Error("Já tem uma live deste quadro no ar.");
  const duracao = Math.min(Math.max(Math.round(o.duracao_min) || 60, 10), 360);
  const modalidade = o.modalidade && modalidadesDo(quadro).includes(o.modalidade) ? o.modalidade : null;
  let episodio_id: string | null = null;
  if (o.episodio_id) {
    const { data: ep } = await db().from("agenda_episodios").select("id, quadro").eq("id", o.episodio_id).maybeSingle();
    if (ep?.quadro === quadro) episodio_id = ep.id;
  }
  const { data, error } = await db()
    .from("ao_vivo_sessoes")
    .insert({
      quadro,
      modalidade,
      episodio_id,
      titulo: o.titulo,
      duracao_prevista_min: duracao,
      iniciada_por: o.por,
    })
    .select("*")
    .single();
  if (error || !data) {
    // O índice único barra duas lives do quadro (duas pessoas apertando juntas).
    throw new Error(error?.code === "23505" ? "Já tem uma live deste quadro no ar." : error?.message ?? "Não deu para começar.");
  }
  const sessao = data as Sessao;
  const fila = montarFila((await cotasDaLive(quadro, modalidade)).map(paraPlano), duracao);
  if (fila.length) {
    const { error: e2 } = await db().from("ao_vivo_insercoes").insert(fila.map((i) => ({ ...i, sessao_id: sessao.id })));
    if (e2) {
      await db().from("ao_vivo_sessoes").delete().eq("id", sessao.id);
      throw new Error(e2.message);
    }
  }
  return sessao;
}

/** Roda o relógio da live e devolve a hora do banco (a referência de tudo). */
async function avancar(sessaoId: string): Promise<string> {
  const { data, error } = await db().rpc("ao_vivo_avancar", { p_sessao: sessaoId, p_gap_s: GAP_S });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? new Date(data).toISOString() : new Date().toISOString();
}

async function insercoesDa(sessaoId: string): Promise<Insercao[]> {
  const { data, error } = await db()
    .from("ao_vivo_insercoes")
    .select("id, sessao_id, cota_id, partner_id, tipo, momento, previsto_s, duracao_s, prioridade, status, inicio_em, fim_em, disparo")
    .eq("sessao_id", sessaoId)
    .order("previsto_s", { ascending: true, nullsFirst: false })
    .order("prioridade", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Insercao[];
}

// ---------------------------------------------------------------- tela do OBS

const urlsAssinadas = new Map<string, { url: string; ate: number }>();
const qrs = new Map<string, string>();

/** Assina por 6 h e reaproveita: a tela pede a cada segundo. */
async function urlDa(path: string): Promise<string | null> {
  const c = urlsAssinadas.get(path);
  if (c && c.ate > Date.now() + 30 * 60_000) return c.url;
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 6 * 3600);
  if (!data?.signedUrl) return null;
  urlsAssinadas.set(path, { url: data.signedUrl, ate: Date.now() + 6 * 3600_000 });
  return data.signedUrl;
}

async function qrDo(slug: string): Promise<string> {
  let q = qrs.get(slug);
  if (!q) {
    q = await QRCode.toDataURL(trackingUrl(site.url, slug), {
      width: 480,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    qrs.set(slug, q);
  }
  return q;
}

export async function estadoTela(quadro: QuadroId): Promise<EstadoTela> {
  const sessao = await sessaoAtiva(quadro);
  if (!sessao) return { sessao: null, canto: [], destaque: null };
  await avancar(sessao.id);

  const { data, error } = await db()
    .from("ao_vivo_insercoes")
    .select("id, tipo, momento, cota:ao_vivo_cotas(texto, midia_path, midia_mime, posicao), parceiro:partners(slug, name, logo_url, accent)")
    .eq("sessao_id", sessao.id)
    .eq("status", "no_ar")
    .order("inicio_em");
  if (error) throw new Error(error.message);

  type Linha = {
    id: string;
    tipo: TipoInsercao;
    momento: Momento;
    cota: { texto: string | null; midia_path: string | null; midia_mime: string | null; posicao: Posicao } | null;
    parceiro: { slug: string; name: string; logo_url: string | null; accent: string | null } | null;
  };
  const itens: ItemTela[] = await Promise.all(
    ((data ?? []) as unknown as Linha[]).map(async (l) => ({
      id: l.id,
      tipo: l.tipo,
      momento: l.momento,
      posicao: l.cota?.posicao ?? "inferior-direito",
      texto: l.cota?.texto ?? null,
      parceiro: {
        nome: l.parceiro?.name ?? "",
        logo: l.parceiro?.logo_url ?? null,
        cor: l.parceiro?.accent || "#FFD700",
      },
      midia:
        l.cota?.midia_path && l.cota.midia_mime
          ? await urlDa(l.cota.midia_path).then((url) => (url ? { url, mime: l.cota!.midia_mime! } : null))
          : null,
      qr: l.tipo === "qr" && l.parceiro ? await qrDo(l.parceiro.slug) : null,
      link: l.tipo === "qr" && l.parceiro ? `${site.url.replace(/^https?:\/\/(www\.)?/, "")}/go/${l.parceiro.slug}` : null,
    }))
  );
  return {
    sessao: { id: sessao.id, status: sessao.status },
    canto: itens.filter((i) => i.tipo === "logo"),
    destaque: itens.find((i) => i.tipo !== "logo") ?? null,
  };
}

// ---------------------------------------------------------------- régie

export async function estadoRegie(quadro: QuadroId): Promise<EstadoRegie> {
  const sessao = await sessaoAtiva(quadro);
  const base = {
    quadro: { id: quadro, nome: nomeQuadro(quadro), cor: QUADROS[quadro].accent[1], modalidades: modalidadesDo(quadro) },
  };

  if (!sessao) {
    // Prévia do que entraria, e os episódios de hoje para escolher.
    const agora = Date.now();
    const [todas, { data: eps }] = await Promise.all([
      cotasDaLive(quadro, null).then(async (semMod) => {
        const out: Record<string, { parceiros: number; insercoes: number }> = {};
        const conta = (cs: Cota[]) => ({
          parceiros: new Set(cs.map((c) => c.partner_id)).size,
          insercoes: montarFila(cs.map(paraPlano), 60).length,
        });
        out[""] = conta(semMod);
        for (const m of modalidadesDo(quadro)) out[m] = conta(await cotasDaLive(quadro, m));
        return out;
      }),
      db()
        .from("agenda_episodios")
        .select("id, tema, inicio, duracao_min")
        .eq("quadro", quadro)
        .neq("status", "cancelado")
        .gte("inicio", new Date(agora - 8 * 3600_000).toISOString())
        .lte("inicio", new Date(agora + 16 * 3600_000).toISOString())
        .order("inicio"),
    ]);
    return {
      ...base,
      agora: new Date().toISOString(),
      sessao: null,
      fila: [],
      previa: todas,
      episodios: (eps ?? []).map((e) => ({
        id: e.id,
        titulo: e.tema || nomeQuadro(quadro),
        inicio: e.inicio,
        duracao_min: e.duracao_min,
      })),
    };
  }

  const agoraDb = await avancar(sessao.id);
  const [ins, parceiros] = await Promise.all([
    insercoesDa(sessao.id),
    db()
      .from("ao_vivo_insercoes")
      .select("partner_id, parceiro:partners(name)")
      .eq("sessao_id", sessao.id)
      .then(({ data }) => {
        const m = new Map<string, string>();
        for (const r of (data ?? []) as unknown as { partner_id: string | null; parceiro: { name: string } | null }[])
          if (r.partner_id) m.set(r.partner_id, r.parceiro?.name ?? "");
        return m;
      }),
  ]);
  const fila: ItemFila[] = ins.map((i) => ({
    id: i.id,
    tipo: i.tipo,
    momento: i.momento,
    parceiro: (i.partner_id && parceiros.get(i.partner_id)) || "Parceiro removido",
    previsto_s: i.previsto_s,
    duracao_s: i.duracao_s,
    status: i.status,
    inicio_em: i.inicio_em,
    fim_em: i.fim_em,
    disparo: i.disparo,
  }));
  return {
    ...base,
    agora: agoraDb,
    sessao: {
      id: sessao.id,
      status: sessao.status,
      titulo: sessao.titulo,
      modalidade: sessao.modalidade,
      iniciada_em: sessao.iniciada_em,
      duracao_prevista_min: sessao.duracao_prevista_min,
      segurando: sessao.segurando,
    },
    fila,
    previa: {},
    episodios: [],
  };
}

async function sessaoDoQuadro(quadro: QuadroId): Promise<Sessao> {
  const s = await sessaoAtiva(quadro);
  if (!s) throw new Error("Nenhuma live deste quadro no ar.");
  return s;
}

async function insercaoDa(sessao: Sessao, id: string): Promise<Insercao> {
  const { data } = await db().from("ao_vivo_insercoes").select("*").eq("id", id).eq("sessao_id", sessao.id).maybeSingle();
  if (!data) throw new Error("Inserção não encontrada nesta live.");
  return data as Insercao;
}

export type AcaoRegie =
  | { acao: "segurar"; valor: boolean }
  | { acao: "agora"; id: string }
  | { acao: "pular"; id: string }
  | { acao: "tirar"; id: string }
  | { acao: "encerramento" }
  | { acao: "encerrar" };

export async function acaoRegie(quadro: QuadroId, a: AcaoRegie): Promise<void> {
  const s = await sessaoDoQuadro(quadro);
  const tab = () => db().from("ao_vivo_insercoes");
  const ok = ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
  };

  switch (a.acao) {
    case "segurar":
      ok(await db().from("ao_vivo_sessoes").update({ segurando: a.valor }).eq("id", s.id));
      break;

    case "agora": {
      const i = await insercaoDa(s, a.id);
      if (i.status !== "pendente") throw new Error("Essa inserção já saiu da fila.");
      // Fura a fila e o respiro; se algo estiver no ar, entra logo depois.
      // A do encerramento não tem hora: ganha 0 só para o relógio enxergá-la.
      ok(await tab().update({ disparo: "manual", previsto_s: i.previsto_s ?? 0 }).eq("id", i.id).eq("status", "pendente"));
      if (s.segurando) ok(await db().from("ao_vivo_sessoes").update({ segurando: false }).eq("id", s.id));
      break;
    }

    case "pular": {
      const i = await insercaoDa(s, a.id);
      if (i.status !== "pendente") throw new Error("Só dá para pular o que está na fila.");
      ok(await tab().update({ status: "pulada" }).eq("id", i.id).eq("status", "pendente"));
      break;
    }

    case "tirar": {
      const i = await insercaoDa(s, a.id);
      if (i.status !== "no_ar") throw new Error("Essa inserção não está no ar.");
      // Fica como exibida, com o tempo real: é o que vai para o relatório.
      // Hora do banco, como a de entrada: relógio do servidor atrasado dava tempo negativo.
      ok(await tab().update({ status: "exibida", fim_em: await avancar(s.id) }).eq("id", i.id).eq("status", "no_ar"));
      break;
    }

    case "encerramento":
      ok(
        await tab()
          // 0 = já na vez; no encerramento o relógio as põe antes das "durante" atrasadas.
          .update({ previsto_s: 0 })
          .eq("sessao_id", s.id)
          .eq("status", "pendente")
          .eq("momento", "encerramento")
      );
      ok(await db().from("ao_vivo_sessoes").update({ status: "encerramento", segurando: false }).eq("id", s.id));
      break;

    case "encerrar": {
      // O avancar fecha o que já cumpriu o tempo e dá a hora do banco para o resto.
      const agora = await avancar(s.id);
      ok(await tab().update({ status: "exibida", fim_em: agora }).eq("sessao_id", s.id).eq("status", "no_ar"));
      ok(await tab().update({ status: "perdida" }).eq("sessao_id", s.id).eq("status", "pendente"));
      ok(await db().from("ao_vivo_sessoes").update({ status: "encerrada", encerrada_em: agora, segurando: false }).eq("id", s.id));
      break;
    }
  }
}

// ---------------------------------------------------------------- relatório

export type LinhaRelatorio = {
  partner_id: string;
  parceiro: string;
  lives: number;
  exibidas: number;
  segundos: number;
  naoEntraram: number;
  porTipo: Partial<Record<TipoInsercao, number>>;
};

/** Prova de veiculação: o que cada parceiro teve no ar entre `de` e `ate` (datas BRT, inclusivas). */
export async function relatorio(de: string, ate: string): Promise<{ linhas: LinhaRelatorio[]; lives: Sessao[] }> {
  const ini = new Date(`${de}T00:00:00-03:00`).toISOString();
  const fim = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86_400_000).toISOString();
  const { data: sess } = await db()
    .from("ao_vivo_sessoes")
    .select("*")
    .gte("iniciada_em", ini)
    .lt("iniciada_em", fim)
    .order("iniciada_em", { ascending: false });
  const lives = (sess ?? []) as Sessao[];
  if (!lives.length) return { linhas: [], lives };

  const { data } = await db()
    .from("ao_vivo_insercoes")
    .select("sessao_id, partner_id, tipo, status, inicio_em, fim_em, parceiro:partners(name)")
    .in("sessao_id", lives.map((l) => l.id));
  const m = new Map<string, LinhaRelatorio & { _lives: Set<string> }>();
  type R = {
    sessao_id: string;
    partner_id: string | null;
    tipo: TipoInsercao;
    status: StatusInsercao;
    inicio_em: string | null;
    fim_em: string | null;
    parceiro: { name: string } | null;
  };
  for (const r of (data ?? []) as unknown as R[]) {
    if (!r.partner_id) continue;
    const l =
      m.get(r.partner_id) ??
      { partner_id: r.partner_id, parceiro: r.parceiro?.name ?? "", lives: 0, exibidas: 0, segundos: 0, naoEntraram: 0, porTipo: {}, _lives: new Set<string>() };
    if (r.status === "exibida" && r.inicio_em && r.fim_em) {
      l.exibidas++;
      l.segundos += Math.max(0, Math.round((new Date(r.fim_em).getTime() - new Date(r.inicio_em).getTime()) / 1000));
      l.porTipo[r.tipo] = (l.porTipo[r.tipo] ?? 0) + 1;
      l._lives.add(r.sessao_id);
    } else if (r.status === "perdida" || r.status === "pulada") {
      l.naoEntraram++;
    }
    m.set(r.partner_id, l);
  }
  const linhas = Array.from(m.values())
    .map(({ _lives, ...l }) => ({ ...l, lives: _lives.size }))
    .sort((a, b) => b.segundos - a.segundos);
  return { linhas, lives };
}
