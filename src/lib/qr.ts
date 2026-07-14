import "server-only";
import QRCode from "qrcode";

/** Gera um QR code como data URL (PNG) para exibir/baixar no admin. */
export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
}

/** URL absoluta de tracking do parceiro (destino do QR). */
export function trackingUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, "")}/go/${slug}?src=qr`;
}
