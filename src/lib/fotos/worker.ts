/**
 * Processa as fotos fora da tela principal e dentro do navegador: o arquivo
 * original não sobe para o servidor, então não há limite de upload nem custo.
 */

import { analisarFaixas, removerFaixas, type Analise, type Imagem, type ModoDirecao } from "./faixas";
import { calcularRecorte, tamanhoFinal, type Enquadro, type Qualidade } from "./enquadro";
import { aplicarTratamento, type Ajustes } from "./tratamento";

export type ResumoFaixas = { encontrou: boolean; direcao: "horizontal" | "vertical"; faixas: number; intensidade: number };

export type Pedido =
  | { tipo: "abrir"; id: string; arquivo: File }
  | { tipo: "fechar"; id: string }
  | { tipo: "previa"; id: string; seq: number; modo: ModoDirecao; ajustes: Ajustes; enquadro: Enquadro }
  | { tipo: "exportar"; id: string; seq: number; modo: ModoDirecao; ajustes: Ajustes; enquadro: Enquadro; qualidade: Qualidade };

export type Resposta =
  | { tipo: "aberta"; id: string; largura: number; altura: number }
  | { tipo: "previa"; id: string; seq: number; antes: ImageBitmap; depois: ImageBitmap; faixas: ResumoFaixas }
  | { tipo: "exportada"; id: string; seq: number; blob: Blob; largura: number; altura: number }
  | { tipo: "erro"; id: string; seq?: number; mensagem: string };

const canal = self as unknown as {
  postMessage(m: Resposta, t?: Transferable[]): void;
  onmessage: ((e: MessageEvent<Pedido>) => void) | null;
};

const LADO_ANALISE = 1200;
const LADO_PREVIA = 1500;
const LARGURA_TELA = 1000;

type Foto = {
  arquivo: File;
  largura: number;
  altura: number;
  previa: Imagem;
  analise: Imagem;
  analises: Map<ModoDirecao, Analise>;
};

const fotos = new Map<string, Foto>();

function contexto(c: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("O navegador não liberou o processamento da imagem.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

function reduzir(fonte: ImageBitmap, lado: number): Imagem {
  const escala = Math.min(1, lado / Math.max(fonte.width, fonte.height));
  const width = Math.max(1, Math.round(fonte.width * escala));
  const height = Math.max(1, Math.round(fonte.height * escala));
  const c = new OffscreenCanvas(width, height);
  const ctx = contexto(c);
  ctx.drawImage(fonte, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

function paraCanvas(img: Imagem): OffscreenCanvas {
  const c = new OffscreenCanvas(img.width, img.height);
  contexto(c).putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

function obterAnalise(f: Foto, modo: ModoDirecao): Analise {
  let a = f.analises.get(modo);
  if (!a) {
    a = analisarFaixas(f.analise, modo);
    f.analises.set(modo, a);
  }
  return a;
}

function recortar(fonte: OffscreenCanvas, enquadro: Enquadro, width: number, height: number): Imagem {
  const r = calcularRecorte(fonte.width, fonte.height, enquadro);
  const c = new OffscreenCanvas(width, height);
  const ctx = contexto(c);
  ctx.drawImage(fonte, r.sx, r.sy, r.sw, r.sh, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

async function abrir(id: string, arquivo: File) {
  const bitmap = await createImageBitmap(arquivo);
  const foto: Foto = {
    arquivo,
    largura: bitmap.width,
    altura: bitmap.height,
    previa: reduzir(bitmap, LADO_PREVIA),
    analise: reduzir(bitmap, LADO_ANALISE),
    analises: new Map(),
  };
  bitmap.close();
  fotos.set(id, foto);
  canal.postMessage({ tipo: "aberta", id, largura: foto.largura, altura: foto.altura });
}

async function previa(p: Extract<Pedido, { tipo: "previa" }>) {
  const f = fotos.get(p.id);
  if (!f) return;
  const analise = obterAnalise(f, p.modo);

  const r = calcularRecorte(f.previa.width, f.previa.height, p.enquadro);
  const escala = Math.min(1, LARGURA_TELA / r.sw);
  const width = Math.max(1, Math.round(r.sw * escala));
  const height = Math.max(1, Math.round(r.sh * escala));

  const antes = recortar(paraCanvas(f.previa), p.enquadro, width, height);
  const corrigida: Imagem = { ...f.previa, data: new Uint8ClampedArray(f.previa.data) };
  removerFaixas(corrigida, analise, p.ajustes.faixas / 100);
  const depois = recortar(paraCanvas(corrigida), p.enquadro, width, height);
  aplicarTratamento(depois, p.ajustes);

  const [bA, bD] = await Promise.all([createImageBitmap(paraCanvas(antes)), createImageBitmap(paraCanvas(depois))]);
  canal.postMessage(
    {
      tipo: "previa",
      id: p.id,
      seq: p.seq,
      antes: bA,
      depois: bD,
      faixas: { encontrou: analise.encontrou, direcao: analise.direcao, faixas: analise.faixas, intensidade: analise.intensidade },
    },
    [bA, bD]
  );
}

async function exportar(p: Extract<Pedido, { tipo: "exportar" }>) {
  const f = fotos.get(p.id);
  if (!f) return;
  const analise = obterAnalise(f, p.modo);

  // A correção roda na resolução cheia, antes de reduzir para o tamanho final.
  const bitmap = await createImageBitmap(f.arquivo);
  const cheia = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = contexto(cheia);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const dados = ctx.getImageData(0, 0, cheia.width, cheia.height);
  removerFaixas({ data: dados.data, width: dados.width, height: dados.height }, analise, p.ajustes.faixas / 100);
  ctx.putImageData(dados, 0, 0);

  const r = calcularRecorte(cheia.width, cheia.height, p.enquadro);
  const { width, height } = tamanhoFinal(r, p.enquadro.formato, p.qualidade);
  const final = recortar(cheia, p.enquadro, width, height);
  aplicarTratamento(final, p.ajustes);

  const blob = await paraCanvas(final).convertToBlob({ type: "image/jpeg", quality: 0.94 });
  canal.postMessage({ tipo: "exportada", id: p.id, seq: p.seq, blob, largura: width, altura: height });
}

/** Uma tarefa por vez: prévia e exportação disputariam a memória da aba. */
let fila: Promise<void> = Promise.resolve();

canal.onmessage = (e) => {
  const p = e.data;
  if (p.tipo === "fechar") {
    fotos.delete(p.id);
    return;
  }
  fila = fila.then(async () => {
    try {
      if (p.tipo === "abrir") await abrir(p.id, p.arquivo);
      else if (p.tipo === "previa") await previa(p);
      else await exportar(p);
    } catch (err) {
      const seq = p.tipo === "abrir" ? undefined : p.seq;
      const mensagem =
        p.tipo === "abrir"
          ? "Não consegui abrir este arquivo. Use JPG, PNG ou WebP (foto HEIC do iPhone precisa ser convertida)."
          : err instanceof Error
            ? err.message
            : "Falha ao processar a foto.";
      canal.postMessage({ tipo: "erro", id: p.id, seq, mensagem });
    }
  });
};
