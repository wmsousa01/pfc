"use server";

import { revalidatePath } from "next/cache";
import { exigir } from "@/lib/auth";
import { AVULSA, chavePreset, limparPreset, type Preset } from "@/lib/fotos/preset";
import { clearConfig, setConfig } from "@/lib/producao/store";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { isGeminiConfigured } from "@/lib/producao/gemini";
import { montarPost, type PostSugerido } from "@/lib/posts/ia";
import { lerNumerosPeriodo } from "@/lib/posts/numeros";
import { renderPost } from "@/lib/posts/render";
import { conferirFoto, guardarArtes, pedirEnvioFoto, publicarNoInstagram, type Publicado } from "@/lib/posts/publicar";
import {
  LIMITE_ITENS,
  PASTA_ARTES,
  caminhoFotoValido,
  type FormatoPost,
  type NumerosPost,
  type PedidoPost,
  type PeriodoNumeros,
  type SlideGerado,
} from "@/lib/posts/tipos";

const valido = (quadro: string) => quadro === AVULSA || isQuadroId(quadro);

export async function salvarPresetAction(quadro: string, bruto: unknown): Promise<{ ok: boolean; erro?: string; preset?: Preset }> {
  await exigir("fotos.editar");
  if (!valido(quadro)) return { ok: false, erro: "Quadro desconhecido." };
  try {
    const preset = limparPreset(bruto);
    await setConfig(chavePreset(quadro), JSON.stringify(preset));
    revalidatePath("/admin/fotos");
    return { ok: true, preset };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui salvar o ajuste." };
  }
}

export async function restaurarPresetAction(quadro: string): Promise<{ ok: boolean; erro?: string }> {
  await exigir("fotos.editar");
  if (!valido(quadro)) return { ok: false, erro: "Quadro desconhecido." };
  try {
    await clearConfig(chavePreset(quadro));
    revalidatePath("/admin/fotos");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui restaurar o ajuste." };
  }
}

// ---------------------------------------------------------------- posts

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const numero = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const talvez = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
/** Só caminho de foto enviado por esta tela: nada de ler outro arquivo do armazenamento. */
const foto = (v: unknown) => (caminhoFotoValido(v) ? v : null);

/** O pedido vem do navegador: só passa o que o desenho usa, com tamanho limitado. */
function limparPedido(bruto: unknown): PedidoPost {
  const p = (bruto ?? {}) as Record<string, unknown>;
  const quadro = valido(String(p.quadro)) ? String(p.quadro) : AVULSA;
  if (p.tipo === "numeros") {
    const n = (p.numeros ?? {}) as Record<string, unknown>;
    const s = (p.slides ?? {}) as Record<string, unknown>;
    return {
      tipo: "numeros",
      quadro,
      chamada: texto(p.chamada, 80),
      fotoCapa: foto(p.fotoCapa),
      slides: { capa: !!s.capa, views: !!s.views, horas: !!s.horas, inscritos: !!s.inscritos, top: !!s.top, fechamento: !!s.fechamento },
      numeros: {
        periodo: texto(n.periodo, 40),
        views: numero(n.views),
        viewsVar: talvez(n.viewsVar),
        horas: numero(n.horas),
        horasVar: talvez(n.horasVar),
        novosInscritos: numero(n.novosInscritos),
        inscritosTotal: talvez(n.inscritosTotal),
        shortsPct: talvez(n.shortsPct),
        top: (Array.isArray(n.top) ? n.top : []).slice(0, 3).map((v: Record<string, unknown>) => ({ titulo: texto(v?.titulo, 140), views: numero(v?.views) })),
      },
    };
  }
  if (p.tipo === "texto") {
    return {
      tipo: "texto",
      quadro,
      titulo: texto(p.titulo, 120),
      subtitulo: texto(p.subtitulo, 200),
      chamada: texto(p.chamada, 80),
      fotoCapa: foto(p.fotoCapa),
      itens: (Array.isArray(p.itens) ? p.itens : [])
        .slice(0, LIMITE_ITENS)
        .map((i: Record<string, unknown>) => ({ titulo: texto(i?.titulo, 100), texto: texto(i?.texto, 500), foto: foto(i?.foto) })),
    };
  }
  const formato = (["4:5", "1:1", "9:16"] as FormatoPost[]).includes(p.formato as FormatoPost) ? (p.formato as FormatoPost) : "4:5";
  return {
    tipo: "cartaz",
    quadro,
    formato,
    chapeu: texto(p.chapeu, 60),
    titulo: texto(p.titulo, 120),
    mensagem: texto(p.mensagem, 300),
    assinatura: texto(p.assinatura, 60),
    foto: foto(p.foto),
  };
}

export async function buscarNumerosAction(periodo: PeriodoNumeros): Promise<{ ok: boolean; erro?: string; numeros?: NumerosPost }> {
  await exigir("fotos.editar");
  if (!["semana", "28d", "mes"].includes(periodo)) return { ok: false, erro: "Período desconhecido." };
  try {
    return { ok: true, numeros: await lerNumerosPeriodo(periodo) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui ler os números do canal." };
  }
}

/** Link para o navegador enviar a foto já tratada direto para o armazenamento. */
export async function pedirEnvioFotoAction(): Promise<{ ok: boolean; erro?: string; path?: string; url?: string }> {
  await exigir("fotos.editar");
  try {
    return { ok: true, ...(await pedirEnvioFoto()) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui preparar o envio da foto." };
  }
}

export async function conferirFotoAction(path: string): Promise<{ ok: boolean; erro?: string }> {
  await exigir("fotos.editar");
  if (!caminhoFotoValido(path)) return { ok: false, erro: "Foto inválida." };
  try {
    await conferirFoto(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "A foto não chegou." };
  }
}

/** As artes ficam guardadas: a tela recebe links (não a imagem), e a publicação usa os mesmos arquivos. */
export async function gerarPostAction(bruto: unknown): Promise<{ ok: boolean; erro?: string; slides?: SlideGerado[] }> {
  await exigir("fotos.editar");
  try {
    const artes = await renderPost(limparPedido(bruto));
    return { ok: true, slides: await guardarArtes(artes) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui gerar o post." };
  }
}

export async function montarComIAAction(ideia: string, quadro: string): Promise<{ ok: boolean; erro?: string; post?: PostSugerido }> {
  await exigir("fotos.editar");
  const texto = typeof ideia === "string" ? ideia.trim().slice(0, 2000) : "";
  if (texto.length < 10) return { ok: false, erro: "Descreva a ideia com um pouco mais de detalhe." };
  if (!isGeminiConfigured()) return { ok: false, erro: "A IA não está configurada no servidor (GOOGLE_AI_API_KEY)." };
  const nome = isQuadroId(quadro) ? QUADROS[quadro].name : "Fora da Caixa (geral)";
  try {
    return { ok: true, post: await montarPost(texto, nome) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "A IA não conseguiu montar o post." };
  }
}

export async function publicarPostAction(entrada: {
  paths: string[];
  legenda: string;
  perfilId: number | null;
  story: boolean;
}): Promise<{ ok: boolean; erro?: string; publicado?: Publicado }> {
  await exigir("fotos.editar");
  const paths = (Array.isArray(entrada?.paths) ? entrada.paths : []).filter(
    (p): p is string => typeof p === "string" && p.startsWith(PASTA_ARTES) && /^[\w/.-]+$/.test(p) && !p.includes("..")
  );
  try {
    const publicado = await publicarNoInstagram({
      paths,
      legenda: texto(entrada?.legenda, 2200),
      perfilId: Number.isInteger(entrada?.perfilId) ? (entrada.perfilId as number) : null,
      story: !!entrada?.story,
    });
    return { ok: true, publicado };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui publicar no Instagram." };
  }
}
