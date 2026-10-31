export const HASHTAGS = "#ForaDaCaixa #MogiGuaçu #podcast";

/** Legenda padrão de um corte: título, descrição do Contenta e as hashtags do canal. */
export function defaultCaption(cut: { title: string | null; description: string | null }): string {
  return [cut.title, cut.description, HASHTAGS].filter(Boolean).join("\n\n");
}
