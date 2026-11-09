/** As partes de uma matéria do roteiro que dá para sugerir edição (servidor e navegador). */
export type Campo = "manchete" | "leitura" | "comentario" | "humor" | "reflexao" | "pontos" | "servico" | "geral";

export const CAMPOS: Record<Campo, string> = {
  manchete: "Manchete (GC)",
  leitura: "Notícia para leitura",
  comentario: "Comentário do apresentador",
  humor: "Humor (H)",
  reflexao: "Pergunta para reflexão",
  pontos: "Tópicos da reflexão",
  servico: "Serviço ao telespectador",
  geral: "Comentário geral",
};

export const isCampo = (v: string): v is Campo => v in CAMPOS;
