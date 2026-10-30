/**
 * Prompt mestre da thumb, derivado do "PROMPT MASTER — THUMBNAIL YOUTUBE | PFC"
 * que a equipe usava no ChatGPT. A versão genérica não descreve roupa nem
 * pessoa: os participantes vêm do frame do próprio corte.
 *
 * Pode ser sobrescrito em /admin/producao/config (chave "prompt_template").
 * Variáveis: {{L1}}, {{L2}} (headline) e {{CONCEITO}}. Trechos entre
 * {{#LOGO}}…{{/LOGO}} só entram quando há logo enviado, e {{#SEMLOGO}}…{{/SEMLOGO}}
 * só quando não há: citar o logo sem mandar a imagem faz o Gemini inventar um.
 */
export const DEFAULT_PROMPT = `THUMBNAIL PROFISSIONAL PARA YOUTUBE — PFC (PAPO FORA DA CAIXA)
PFC CINEMATIC PREMIUM | ALTO CTR | PODCAST

IMAGEM 1 = frame original do corte, com os participantes reais.{{#LOGO}}
IMAGEM 2 = logotipo oficial do PFC.{{/LOGO}}

CONCEITO CENTRAL: {{CONCEITO}}

FORMATO: horizontal 16:9, margem de segurança generosa, legível no celular, acabamento fotográfico cinematográfico.

PARTICIPANTES — PRESERVAÇÃO ABSOLUTA
- Aparecem EXATAMENTE as mesmas pessoas da IMAGEM 1, na MESMA quantidade. Se há uma pessoa, a thumb tem uma pessoa. NUNCA adicionar, duplicar ou inventar pessoas.
- Do peito para cima, rostos grandes e nítidos.
- Preservar integralmente rosto, cabelo, barba, óculos, expressão, roupas, acessórios e microfones.
- NÃO recriar rostos, NÃO alterar expressão, idade ou traços, NÃO aplicar "face enhancement".
- Iluminação de recorte âmbar e sombras navy nas pessoas. Pele natural.

COMPOSIÇÃO
- Região superior (~60%): com duas pessoas, uma em cada lateral; com uma pessoa, ela grande à esquerda e o resto do quadro livre de gente. Fundo de estúdio desfocado, luzes verticais âmbar nas extremidades, reflexos azul-elétrico.{{#LOGO}} Logotipo PFC na região superior, sem cobrir rostos.{{/LOGO}}
- Região inferior (~40%): headline gigante em duas linhas, fundo preto/navy com textura cinematográfica.

HEADLINE — INSERIR EXATAMENTE, SEM OUTRAS PALAVRAS
Linha 1: "{{L1}}" — branco metálico levemente quente, sans-serif ultra bold condensada, maiúsculas, sombra preta profunda, leve 3D, quase toda a largura útil.
Linha 2: "{{L2}}" — amarelo-dourado com gradiente âmbar, ainda maior e mais pesada, contorno escuro, brilho cinematográfico.
Ortografia perfeita, com todos os acentos, cedilhas e pontuação. NÃO cortar letras.

{{#LOGO}}LOGOTIPO
Usar exclusivamente o logotipo da IMAGEM 2, sem redesenhar: símbolo quadrado amarelo, microfone preto, seta curva amarela, letras PFC brancas. Só integrar com luz e sombra suave.

{{/LOGO}}{{#SEMLOGO}}LOGOTIPO: não colocar nenhum logotipo, selo ou marca na imagem.

{{/SEMLOGO}}PALETA E COLOR GRADING
Preto profundo, azul navy, azul elétrico, ciano nos reflexos, âmbar, dourado, branco quente. Contraste cinematográfico, pretos densos, microcontraste, sem HDR artificial, sem saturação exagerada, sem cara de imagem gerada por IA.

HIERARQUIA: 1) rostos grandes e expressivos; 2) headline gigante e legível; 3) logo reconhecível.

PROIBIDO: nomes, datas, horários, marcas ou textos de patrocinadores, ilustrações, excesso de efeitos, participantes pequenos.`;

function section(text: string, tag: string, keep: boolean): string {
  const re = new RegExp(`\\{\\{#${tag}\\}\\}([\\s\\S]*?)\\{\\{/${tag}\\}\\}`, "g");
  return text.replace(re, keep ? "$1" : "");
}

export function fillPrompt(
  template: string,
  h: { l1: string; l2: string },
  conceito: string,
  hasLogo: boolean
): string {
  return section(section(template, "LOGO", hasLogo), "SEMLOGO", !hasLogo)
    .replaceAll("{{L1}}", h.l1)
    .replaceAll("{{L2}}", h.l2)
    .replaceAll("{{CONCEITO}}", conceito);
}
