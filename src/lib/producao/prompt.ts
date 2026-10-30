/**
 * Prompt do FUNDO da thumb. Desde 30/10/2026 o Gemini não desenha mais a
 * thumb inteira: pedir para ele manter os participantes fazia ele redesenhar
 * os rostos (olhos abertos no lugar de fechados, cabeça virada para a
 * câmera). Agora ele gera só o estúdio vazio; as pessoas reais (recorte do
 * frame), a headline e o logo oficial entram por cima na composição.
 *
 * Vem da paleta do "PROMPT MASTER — THUMBNAIL YOUTUBE | PFC" que a equipe
 * usava no ChatGPT. Pode ser sobrescrito em /admin/producao/config (chave
 * "plate_prompt").
 */
export const DEFAULT_PLATE_PROMPT = `Photographic background plate for a premium podcast YouTube thumbnail, 16:9.
An EMPTY professional podcast studio: absolutely no people, no text, no letters, no logos, no microphones in the foreground.
Cinematic look: deep black and navy blue, tall vertical warm amber light strips near the left and right edges, soft electric-blue and cyan bokeh reflections in the middle distance, shallow depth of field, subtle haze, fine film grain.
The center of the frame stays dark and uncluttered (people will be composited there later). The bottom 40% fades to almost black.
High contrast, dense blacks, no artificial HDR, no oversaturation.`;
