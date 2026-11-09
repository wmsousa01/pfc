/**
 * Diferença palavra a palavra entre dois textos (LCS), para mostrar uma
 * sugestão de edição do jeito que o Docs mostra: o que sai riscado, o que
 * entra destacado. Textos de roteiro têm no máximo algumas centenas de
 * palavras por parte; acima de 1.500 palavras de cada lado, vira troca
 * inteira para não pesar no navegador.
 */
export type Trecho = { tipo: "igual" | "sai" | "entra"; texto: string };

export function diferenca(antes: string, depois: string): Trecho[] {
  const a = antes.split(/(\s+)/).filter(Boolean);
  const b = depois.split(/(\s+)/).filter(Boolean);
  if (a.length > 3000 || b.length > 3000) return [{ tipo: "sai", texto: antes }, { tipo: "entra", texto: depois }];
  // lcs[i][j] = tamanho da maior subsequência comum de a[i..] e b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: Trecho[] = [];
  const push = (tipo: Trecho["tipo"], texto: string) => {
    const ultimo = out[out.length - 1];
    if (ultimo?.tipo === tipo) ultimo.texto += texto;
    else out.push({ tipo, texto });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("igual", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("sai", a[i++]);
    else push("entra", b[j++]);
  }
  while (i < a.length) push("sai", a[i++]);
  while (j < b.length) push("entra", b[j++]);
  return out;
}
