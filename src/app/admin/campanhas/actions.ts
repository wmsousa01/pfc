"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/app/admin/producao/actions";
import { analisarCriativo, sugerirCopy } from "@/lib/campanhas/analise";
import { gerarEstatico } from "@/lib/campanhas/estatico";
import { escolherConta } from "@/lib/campanhas/google-ads";
import {
  PASTA_KEY,
  formatoDe,
  importarDoContenta,
  importarDoDrive,
  pedirUploadCriativo,
  registrarUpload,
} from "@/lib/campanhas/fontes";
import { subirNaMeta } from "@/lib/campanhas/meta-ads";
import { sincronizarMetricas } from "@/lib/campanhas/metricas";
import { MODELOS } from "@/lib/campanhas/modelos";
import { pecaPorCodigo } from "@/lib/campanhas/plano";
import {
  CTAS,
  OBJETIVOS,
  db,
  getCriativo,
  getEntrega,
  getEstrategia,
  updateCriativo,
  updateEntrega,
  updateEstrategia,
  type EstrategiaStatus,
  type Objetivo,
  type Plataforma,
} from "@/lib/campanhas/store";
import { setConfig } from "@/lib/producao/store";
import { deleteConnections } from "@/lib/social/store";

const BASE = "/admin/campanhas";
const refresh = () => revalidatePath(BASE, "layout");

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function actorOf(role: { email: string | null; userId: string }): string {
  return role.email ?? role.userId;
}

function fail(e: unknown): ActionState {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

const intDe = (v: string, min: number, max: number, padrao: number) => {
  const n = Math.round(Number(v.replace(",", ".")));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao;
};

/** "20" ou "20,50" (reais) → centavos. */
const centavos = (v: string) => {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 6) throw new Error("Orçamento diário mínimo da Meta: R$ 6,00.");
  return Math.round(n * 100);
};

const dataOuNull = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// ---- Estratégias ----

export async function criarEstrategiaAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  const modelo = MODELOS[str(form, "modelo")]?.m;
  const { data, error } = await db()
    .from("mkt_estrategias")
    .insert({ ...(modelo ?? { nome: "Nova estratégia" }), plataformas: ["meta"], created_by: actorOf(role) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  refresh();
  redirect(`${BASE}/${data.id}`);
}

export async function salvarEstrategiaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const id = str(form, "id");
    const e = await getEstrategia(id);
    if (!e) throw new Error("Estratégia não encontrada.");
    const objetivo = str(form, "objetivo") as Objetivo;
    if (!(objetivo in OBJETIVOS)) throw new Error("Objetivo inválido.");
    const cta = str(form, "cta");
    const idadeMin = intDe(str(form, "idade_min"), 18, 65, 18);
    const plataformas = form.getAll("plataformas").map(String).filter((p): p is Plataforma => p === "meta" || p === "google");
    const orcamento = centavos(str(form, "orcamento"));
    // Campanha e conjunto já criados na Meta não mudam daqui: avisar em vez de divergir calado.
    const travado = !!e.meta_adset_id && (objetivo !== e.objetivo || orcamento !== e.orcamento_diario);
    await updateEstrategia(id, {
      nome: str(form, "nome") || e.nome,
      objetivo,
      plataformas: plataformas.length ? plataformas : ["meta"],
      publico: str(form, "publico"),
      oferta: str(form, "oferta"),
      mensagem: str(form, "mensagem"),
      angulos: str(form, "angulos")
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 10),
      link: str(form, "link") || null,
      cta: cta in CTAS ? cta : "LEARN_MORE",
      geo_raio_km: intDe(str(form, "geo_raio_km"), 1, 80, 15),
      idade_min: idadeMin,
      idade_max: Math.max(idadeMin, intDe(str(form, "idade_max"), 18, 65, 65)),
      orcamento_diario: orcamento,
      inicio: dataOuNull(str(form, "inicio")),
      fim: dataOuNull(str(form, "fim")),
      kpi: str(form, "kpi"),
    });
    refresh();
    return travado
      ? { ok: false, error: "Salvo. Objetivo e orçamento já estão no conjunto da Meta: mude também no Gerenciador de Anúncios." }
      : { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function statusEstrategiaAction(form: FormData): Promise<void> {
  await requireAdmin();
  const s = str(form, "status") as EstrategiaStatus;
  if (!["rascunho", "ativa", "pausada", "encerrada"].includes(s)) return;
  await updateEstrategia(str(form, "id"), { status: s });
  refresh();
}

export async function excluirEstrategiaAction(form: FormData): Promise<void> {
  await requireAdmin();
  await db().from("mkt_estrategias").delete().eq("id", str(form, "id"));
  refresh();
  redirect(BASE);
}

// ---- Entregas: criativo × estratégia × rede ----

export async function entregarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    const estrategiaId = str(form, "estrategia_id");
    const plataforma = str(form, "plataforma") as Plataforma;
    if (plataforma !== "meta" && plataforma !== "google") throw new Error("Escolha a rede.");
    const ids = form.getAll("criativos").map(String);
    if (ids.length === 0) throw new Error("Marque ao menos um criativo.");
    const angulo = str(form, "angulo") || null;
    let repetidos = 0;
    for (const id of ids) {
      const c = await getCriativo(id);
      if (!c) continue;
      const { error } = await db()
        .from("mkt_entregas")
        .insert({
          estrategia_id: estrategiaId,
          criativo_id: id,
          plataforma,
          angulo,
          // A copy da análise da biblioteca já serve de rascunho.
          headline: c.analise?.copy.headline ?? "",
          texto: c.analise?.copy.texto ?? "",
          created_by: actorOf(role),
        });
      if (error?.code === "23505") repetidos++;
      else if (error) throw new Error(error.message);
    }
    refresh();
    return repetidos ? { ok: false, error: `${repetidos} já estava(m) entregue(s) nessa rede.` } : { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function salvarEntregaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const en = await getEntrega(str(form, "id"));
    if (!en) throw new Error("Entrega não encontrada.");
    const googleAd = str(form, "google_ad_id").replace(/\D/g, "");
    await updateEntrega(en.id, {
      angulo: str(form, "angulo") || null,
      // Com o criativo já na Meta, o texto só muda no Gerenciador.
      ...(en.meta_creative_id ? {} : { headline: str(form, "headline").slice(0, 40), texto: str(form, "texto").slice(0, 2000) }),
      ...(en.plataforma === "google"
        ? { google_ad_id: googleAd || null, status: googleAd ? "no_gerenciador" : en.status === "no_gerenciador" ? "aprovado" : en.status }
        : {}),
    });
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function copyIaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const en = await getEntrega(str(form, "id"));
    const e = en && (await getEstrategia(en.estrategia_id));
    if (!en || !e) throw new Error("Entrega não encontrada.");
    if (en.meta_creative_id) throw new Error("O criativo já está na Meta.");
    await updateEntrega(en.id, await sugerirCopy(e, en.angulo));
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

/** Análise no contexto da estratégia; preenche a copy se ainda estiver vazia. */
export async function analisarEntregaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const en = await getEntrega(str(form, "id"));
    const e = en && (await getEstrategia(en.estrategia_id));
    const c = en && (await getCriativo(en.criativo_id));
    if (!en || !e || !c) throw new Error("Entrega não encontrada.");
    const a = await analisarCriativo(c, e);
    await updateEntrega(en.id, {
      analise: a,
      analise_nota: a.nota,
      ...(!en.headline && !en.meta_creative_id ? { headline: a.copy.headline } : {}),
      ...(!en.texto && !en.meta_creative_id ? { texto: a.copy.texto } : {}),
    });
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function aprovarEntregaAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  const en = await getEntrega(str(form, "id"));
  if (!en || en.status !== "rascunho") return;
  await updateEntrega(en.id, { status: "aprovado", aprovado_por: actorOf(role) });
  refresh();
}

export async function voltarRascunhoAction(form: FormData): Promise<void> {
  await requireAdmin();
  const en = await getEntrega(str(form, "id"));
  if (!en || en.meta_ad_id || en.google_ad_id) return;
  await updateEntrega(en.id, { status: "rascunho", aprovado_por: null, erro: null });
  refresh();
}

export async function removerEntregaAction(form: FormData): Promise<void> {
  await requireAdmin();
  // Anúncio já criado continua no gerenciador: aqui só sai do painel.
  await db().from("mkt_entregas").delete().eq("id", str(form, "id"));
  refresh();
}

export async function subirMetaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const en = await getEntrega(str(form, "id"));
  if (!en) return { ok: false, error: "Entrega não encontrada." };
  if (en.plataforma !== "meta") return { ok: false, error: "Só entregas da Meta sobem daqui." };
  if (en.status === "rascunho") return { ok: false, error: "Aprove a entrega antes de subir." };
  try {
    const e = await getEstrategia(en.estrategia_id);
    const c = await getCriativo(en.criativo_id);
    if (!e || !c) throw new Error("Estratégia ou criativo não encontrado.");
    await updateEntrega(en.id, { status: "enviando", erro: null });
    const r = await subirNaMeta(en, e, c);
    await updateEntrega(en.id, { status: r === "pronto" ? "no_gerenciador" : "enviando" });
    refresh();
    return r === "pronto"
      ? { ok: true, error: null }
      : { ok: false, error: "A Meta ainda está processando o vídeo. Clique em \"Continuar subida\" em 1–2 minutos." };
  } catch (err) {
    await updateEntrega(en.id, { status: "erro", erro: (err instanceof Error ? err.message : String(err)).slice(0, 500) });
    refresh();
    return fail(err);
  }
}

export async function sincronizarAction(_prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  try {
    const r = await sincronizarMetricas();
    refresh();
    return r.erros.length ? { ok: false, error: r.erros.join(" · ") } : { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function escolherContaGoogleAction(form: FormData): Promise<void> {
  await requireAdmin();
  let destino: string;
  try {
    destino = `${BASE}?ok=${encodeURIComponent(`Google Ads conectado: ${await escolherConta(str(form, "conta"))}`)}`;
  } catch (e) {
    destino = `${BASE}?erro=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`;
  }
  refresh();
  redirect(destino);
}

export async function desconectarAdsAction(form: FormData): Promise<void> {
  await requireAdmin();
  const p = str(form, "platform");
  if (p === "meta_ads" || p === "google_ads") await deleteConnections([p]);
  refresh();
}

// ---- Biblioteca de criativos ----

export async function salvarPastaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const v = str(form, "pasta");
    if (!v) throw new Error("Cole o link da pasta do Drive.");
    await setConfig(PASTA_KEY, v);
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function importarDriveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    const arquivos = form
      .getAll("arquivos")
      .map(String)
      .map((v) => {
        const [id, ...nome] = v.split("|");
        return { id, nome: nome.join("|") };
      })
      .filter((a) => /^[A-Za-z0-9_-]{20,}$/.test(a.id));
    if (arquivos.length === 0) throw new Error("Marque os arquivos da pasta.");
    await importarDoDrive(arquivos, actorOf(role));
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function importarContentaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    const files = form.getAll("cortes").map(String);
    if (files.length === 0) throw new Error("Marque os cortes.");
    await importarDoContenta(str(form, "job"), files, actorOf(role));
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

type Upload = { ok: true; path: string; token: string } | { ok: false; error: string };

export async function pedirUploadAction(nome: string, mime: string, tamanho: number): Promise<Upload> {
  await requireAdmin();
  try {
    return { ok: true, ...(await pedirUploadCriativo(nome, mime, tamanho)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Assinatura do MaterialUploader: o "tipo" escolhido lá é o formato da peça. */
export async function registrarUploadAction(path: string, nome: string, mime: string, formato: string): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    await registrarUpload(path, nome, mime, formato, actorOf(role));
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function analisarCriativoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const c = await getCriativo(str(form, "id"));
    if (!c) throw new Error("Criativo não encontrado.");
    const eid = str(form, "estrategia_id");
    const e = eid ? await getEstrategia(eid) : null;
    const a = await analisarCriativo(c, e);
    await updateCriativo(c.id, { analise: a, analise_nota: a.nota, analisado_em: new Date().toISOString() });
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function classificarCriativoAction(form: FormData): Promise<void> {
  await requireAdmin();
  const peca = pecaPorCodigo(str(form, "peca"));
  await updateCriativo(str(form, "id"), { formato: formatoDe(str(form, "formato")), peca: peca?.codigo ?? null });
  refresh();
}

export async function arquivarCriativoAction(form: FormData): Promise<void> {
  await requireAdmin();
  await updateCriativo(str(form, "id"), { arquivado: true });
  refresh();
}

export async function gerarEstaticoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    const formato = formatoDe(str(form, "formato"));
    if (!formato) throw new Error("Escolha o formato.");
    const eid = str(form, "estrategia_id");
    const e = eid ? await getEstrategia(eid) : null;
    await gerarEstatico(
      {
        formato,
        headline: str(form, "headline"),
        apoio: str(form, "apoio"),
        chamada: str(form, "chamada"),
        refs: form.getAll("refs").map(String),
        instrucao: str(form, "instrucao"),
        comLogo: form.get("logo") === "on",
        peca: pecaPorCodigo(str(form, "peca"))?.codigo ?? null,
      },
      e,
      actorOf(role)
    );
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}
