import "server-only";
import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { InferenceSession as Session } from "onnxruntime-node";

/**
 * Recorte das pessoas do frame com o MODNet (Apache-2.0), rodando aqui mesmo
 * no servidor: ~1 s por imagem, sem custo por chamada. É o que garante que a
 * thumb mostra os rostos reais — o Gemini só faz o fundo.
 *
 * O modelo (~25 MB) vem do Hugging Face no primeiro uso e fica em /tmp
 * enquanto a instância viver.
 */
const MODEL_URL = "https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx";
const MODEL_PATH = path.join(os.tmpdir(), "modnet.onnx");

let session: Promise<Session> | null = null;

async function getSession(): Promise<Session> {
  if (!session) {
    session = (async () => {
      const ort = await import("onnxruntime-node");
      try {
        await fs.access(MODEL_PATH);
      } catch {
        const res = await fetch(MODEL_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Modelo de recorte indisponível (${res.status}).`);
        const tmp = `${MODEL_PATH}.${process.pid}`;
        await fs.writeFile(tmp, Buffer.from(await res.arrayBuffer()));
        await fs.rename(tmp, MODEL_PATH);
      }
      return ort.InferenceSession.create(MODEL_PATH);
    })();
    // Falhou? A próxima chamada tenta de novo em vez de herdar o erro.
    session.catch(() => (session = null));
  }
  return session;
}

export type Matte = {
  /** Frame em RGBA: as pessoas opacas, o resto transparente. */
  rgba: Buffer;
  width: number;
  height: number;
  /** Caixa das pessoas (alpha > 40). */
  box: { x0: number; y0: number; x1: number; y1: number };
};

export async function matte(frame: Buffer): Promise<Matte> {
  const { width: W = 0, height: H = 0 } = await sharp(frame).metadata();
  if (!W || !H) throw new Error("Frame inválido.");

  // MODNet: lado menor 512, dimensões múltiplas de 32, pixels em [-1, 1], NCHW.
  const sc = 512 / Math.min(W, H);
  const w = Math.round((W * sc) / 32) * 32;
  const h = Math.round((H * sc) / 32) * 32;
  const px = await sharp(frame).removeAlpha().resize(w, h, { fit: "fill" }).raw().toBuffer();
  const chw = new Float32Array(3 * w * h);
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) chw[c * w * h + i] = px[i * 3 + c] / 127.5 - 1;
  }

  const ort = await import("onnxruntime-node");
  const s = await getSession();
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", chw, [1, 3, h, w]) });
  const m = out[s.outputNames[0]].data as Float32Array;

  const a8 = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) a8[i] = Math.max(0, Math.min(255, Math.round(m[i] * 255)));
  const alpha = await sharp(a8, { raw: { width: w, height: h, channels: 1 } })
    .resize(W, H, { fit: "fill" })
    .extractChannel(0)
    .raw()
    .toBuffer();

  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha[y * W + x] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) throw new Error("Nenhuma pessoa encontrada no frame.");

  const rgb = await sharp(frame).removeAlpha().raw().toBuffer();
  const rgba = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();
  return { rgba, width: W, height: H, box: { x0, y0, x1, y1 } };
}
