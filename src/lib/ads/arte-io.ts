import "server-only";

/** Storage das artes e logos: o mesmo bucket privado da produção (prefixo ads/). */
export { download, signedUrls, upload } from "@/lib/producao/store";

/** "data:image/png;base64,..." → Buffer PNG (só imagens; até 2 MB). */
export function dataUrlParaBuffer(dataUrl: string | null | undefined): Buffer | null {
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return buf.length > 0 && buf.length <= 2_000_000 ? buf : null;
}
