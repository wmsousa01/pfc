import "server-only";
import sharp from "sharp";
import { activeConnection } from "@/lib/social/store";
import { MetaError, igBusinessDiscovery } from "@/lib/social/meta";

/**
 * Identidade da marca a partir do Instagram, para o Monte seu plano e o chat:
 * nome, foto de perfil (quase sempre a logo) e a cor dominante dela.
 *
 * Lê pelo Business Discovery da Meta com a conta do PFC conectada em
 * /admin/marketing — API oficial, sem scraping. Perfil pessoal não aparece
 * (erro 110); nesse caso o visitante segue sem, nada trava.
 */

export type MarcaIg = {
  username: string;
  nome: string | null;
  seguidores: number | null;
  /** Foto de perfil já reduzida, em data URL (a URL da CDN da Meta expira). */
  logo: string | null;
  /** Cor dominante da logo em hex; null se ela for preto, branco ou cinza. */
  cor: string | null;
};

export type LeituraIg =
  | { ok: true; marca: MarcaIg }
  | { ok: false; motivo: "invalido" | "nao-encontrado" | "indisponivel" };

// Cache por instância: o mesmo @ não gasta a cota da Meta (200 chamadas/hora)
// a cada tecla do visitante ou a cada visita ao link do chat.
const TTL = 60 * 60 * 1000;
const cache = new Map<string, { em: number; r: LeituraIg }>();

/** Cor "de marca" da imagem: o matiz saturado que mais pesa, ignorando fundo branco, preto e cinza. */
export async function corDominante(img: Buffer): Promise<string | null> {
  const { data, info } = await sharp(img).resize(48, 48, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const baldes = new Map<number, { peso: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (s < 0.3 || l < 0.12 || l > 0.9) continue;
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    const balde = Math.floor((((h * 60) + 360) % 360) / 15);
    const x = baldes.get(balde) ?? { peso: 0, r: 0, g: 0, b: 0 };
    x.peso += s;
    x.r += data[i] * s;
    x.g += data[i + 1] * s;
    x.b += data[i + 2] * s;
    baldes.set(balde, x);
  }
  const melhor = Array.from(baldes.values()).sort((a, b) => b.peso - a.peso)[0];
  // Menos de ~4% da imagem colorida: logo monocromática, sem cor de marca.
  if (!melhor || melhor.peso < 48 * 48 * 0.04 * 0.5) return null;
  const hex = (v: number) => Math.round(v / melhor.peso).toString(16).padStart(2, "0");
  return `#${hex(melhor.r)}${hex(melhor.g)}${hex(melhor.b)}`;
}

export async function lerMarcaInstagram(username: string): Promise<LeituraIg> {
  if (!/^[a-z0-9._]{1,30}$/.test(username)) return { ok: false, motivo: "invalido" };
  const c = cache.get(username);
  if (c && Date.now() - c.em < TTL) return c.r;

  const conn = await activeConnection("instagram").catch(() => null);
  if (!conn) return { ok: false, motivo: "indisponivel" };

  let r: LeituraIg;
  try {
    const p = await igBusinessDiscovery(conn.accountId, conn.token, username);
    let logo: string | null = null;
    let cor: string | null = null;
    if (p.picture) {
      try {
        const res = await fetch(p.picture, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const png = await sharp(buf).resize(160, 160, { fit: "cover" }).png().toBuffer();
          logo = `data:image/png;base64,${png.toString("base64")}`;
          cor = await corDominante(buf);
        }
      } catch {
        // Sem a foto, segue com nome e seguidores.
      }
    }
    r = { ok: true, marca: { username: p.username, nome: p.name, seguidores: p.followers, logo, cor } };
  } catch (e) {
    if (e instanceof MetaError && e.code === 110) r = { ok: false, motivo: "nao-encontrado" };
    // Token morto ou Meta fora do ar: não guarda no cache, para tentar de novo.
    else return { ok: false, motivo: "indisponivel" };
  }
  cache.set(username, { em: Date.now(), r });
  return r;
}
