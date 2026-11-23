/**
 * Sobe o arquivo do navegador direto no R2 pela URL assinada que o servidor
 * gerou. O Content-Type tem de ser o mesmo da assinatura.
 */
export async function enviarArquivo(url: string, arquivo: Blob, contentType: string): Promise<void> {
  let r: Response;
  try {
    r = await fetch(url, { method: "PUT", body: arquivo, headers: { "Content-Type": contentType } });
  } catch {
    throw new Error("Falha de conexão no envio. Tente de novo.");
  }
  if (!r.ok) throw new Error(`O envio falhou (${r.status}). Tente de novo.`);
}
