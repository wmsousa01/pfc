/**
 * Encolhe o vídeo do programa durante a inserção em L, falando com o OBS
 * pelo obs-websocket (v5). Quem conecta é a própria tela, que roda dentro do
 * OBS: por isso o endereço é sempre 127.0.0.1 e nada passa pelo servidor.
 *
 * Configuração no fim da URL da fonte, depois do #, que o navegador não envia
 * ao site (a senha fica só no OBS): #obs=SENHA&fonte=ATEM&porta=4455
 *
 * Regras para nunca desmontar uma cena no ar:
 * - ao conectar, não mexe em nada (só desfaz um L que ficou pela metade);
 * - só encolhe a fonte quando ela está em tela cheia. Na "Tela + cam" o ATEM é
 *   uma janela pequena: ali ele fica como está e o L só cobre as bordas;
 * - no fim, devolve exatamente a posição e a escala que encontrou.
 *
 * Se a conexão falhar, o L entra do mesmo jeito, cobrindo as bordas do vídeo.
 */

/** Tamanho do vídeo durante o L: mantém 16:9 e sobra 24% à direita e embaixo. */
export const ESCALA_L = 0.76;
export const ANIMACAO_L_MS = 600;

const FONTE_PADRAO = "ATEM";
const CHAVE_GUARDADO = "ao-vivo-obs-l";
/** Folga para considerar a fonte em tela cheia. */
const TOLERANCIA = 0.02;

export type ObsConfig = { senha: string; fonte: string; porta: number };
export type ObsStatus = "conectando" | "conectado" | "sem-fonte" | "nao-cheia" | "senha-errada" | "sem-conexao";

export function configDoHash(hash: string): ObsConfig | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (!p.has("obs")) return null;
  const porta = Number(p.get("porta"));
  return {
    senha: p.get("obs") ?? "",
    fonte: p.get("fonte")?.trim() || FONTE_PADRAO,
    porta: Number.isInteger(porta) && porta > 0 && porta < 65536 ? porta : 4455,
  };
}

async function sha256b64(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(h))));
}

/** Resposta do desafio de senha do obs-websocket. */
export async function respostaDaSenha(senha: string, salt: string, challenge: string): Promise<string> {
  return sha256b64((await sha256b64(senha + salt)) + challenge);
}

export type Transform = {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  alignment: number;
  boundsType: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
};

/** A fonte ocupa a tela inteira? Com o aparelho desligado o tamanho vem 0: vale a escala. */
export function emTelaCheia(t: Transform, base: { w: number; h: number }): boolean {
  if (t.alignment !== 5 || t.boundsType !== "OBS_BOUNDS_NONE") return false;
  if (Math.abs(t.positionX) > base.w * TOLERANCIA || Math.abs(t.positionY) > base.h * TOLERANCIA) return false;
  if (t.sourceWidth > 0 && t.sourceHeight > 0) {
    return t.width >= base.w * (1 - TOLERANCIA) && t.height >= base.h * (1 - TOLERANCIA);
  }
  return Math.abs(t.scaleX - 1) <= TOLERANCIA && Math.abs(t.scaleY - 1) <= TOLERANCIA;
}

const suave = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Como a fonte estava antes do L, em uma cena. */
type Original = { cena: string; id: number; positionX: number; positionY: number; scaleX: number; scaleY: number };
type Pendente = { ok: (d: Record<string, unknown>) => void; erro: (e: Error) => void };

export class ObsPrograma {
  private ws: WebSocket | null = null;
  private vivo = false;
  private seq = 0;
  private pendentes = new Map<string, Pendente>();
  private tentativa: ReturnType<typeof setTimeout> | null = null;
  private vez = 0;
  private alvo = false;
  private fator = 1;
  private base = { w: 1920, h: 1080 };
  /** Cenas encolhidas agora. Fica guardado para sobreviver a um recarregar da tela no meio do L. */
  private tocadas = new Map<string, Original>();

  constructor(
    private cfg: ObsConfig,
    private aoMudar: (s: ObsStatus) => void
  ) {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_GUARDADO) ?? "[]") as Original[];
      for (const o of salvo) this.tocadas.set(o.cena, o);
      if (this.tocadas.size) this.fator = ESCALA_L;
    } catch {
      // Sem armazenamento local: só não recupera um L interrompido.
    }
  }

  private guardar() {
    try {
      localStorage.setItem(CHAVE_GUARDADO, JSON.stringify(Array.from(this.tocadas.values())));
    } catch {
      // Idem.
    }
  }

  iniciar() {
    this.vivo = true;
    this.conectar();
  }

  parar() {
    this.vivo = false;
    if (this.tentativa) clearTimeout(this.tentativa);
    this.ws?.close();
    this.ws = null;
  }

  /** Liga ou desliga o L. Pode ser chamado a cada consulta: só age quando muda. */
  espremer(ligado: boolean) {
    if (ligado === this.alvo) return;
    this.alvo = ligado;
    void this.sincronizar(true);
  }

  private conectar() {
    if (!this.vivo) return;
    this.aoMudar("conectando");
    const ws = new WebSocket(`ws://127.0.0.1:${this.cfg.porta}`, "obswebsocket.json");
    this.ws = ws;
    ws.onmessage = (m) => void this.receber(ws, JSON.parse(String(m.data)));
    // Conexão recusada pode disparar só o error, sem o close: os dois levam à nova tentativa.
    const caiu = (codigo?: number) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.pendentes.forEach((p) => p.erro(new Error("OBS desconectou")));
      this.pendentes.clear();
      this.aoMudar(codigo === 4009 ? "senha-errada" : "sem-conexao");
      if (this.vivo) this.tentativa = setTimeout(() => this.conectar(), 5000);
    };
    ws.onerror = () => caiu();
    ws.onclose = (ev) => caiu(ev.code);
  }

  private async receber(ws: WebSocket, msg: { op: number; d: Record<string, unknown> }) {
    if (msg.op === 0) {
      const auth = msg.d.authentication as { challenge: string; salt: string } | undefined;
      const d: Record<string, unknown> = { rpcVersion: 1, eventSubscriptions: 1 << 2 };
      if (auth) d.authentication = await respostaDaSenha(this.cfg.senha, auth.salt, auth.challenge);
      ws.send(JSON.stringify({ op: 1, d }));
    } else if (msg.op === 2) {
      try {
        const v = await this.pedir("GetVideoSettings");
        this.base = { w: Number(v.baseWidth) || 1920, h: Number(v.baseHeight) || 1080 };
        this.aoMudar("conectado");
        // Só age se há L em andamento ou um que ficou pela metade.
        if (this.alvo || this.tocadas.size) await this.sincronizar(false);
      } catch {
        // Queda no meio do pedido: o onclose reconecta.
      }
    } else if (msg.op === 5 && msg.d.eventType === "CurrentProgramSceneChanged") {
      // O diretor trocou de cena no meio do L: a cena nova já entra no tamanho certo.
      if (this.alvo) void this.sincronizar(false);
    } else if (msg.op === 7) {
      const p = this.pendentes.get(String(msg.d.requestId));
      if (!p) return;
      this.pendentes.delete(String(msg.d.requestId));
      const st = msg.d.requestStatus as { result: boolean; comment?: string };
      if (st.result) p.ok((msg.d.responseData as Record<string, unknown>) ?? {});
      else p.erro(new Error(st.comment ?? "Pedido recusado pelo OBS"));
    }
  }

  private pedir(requestType: string, requestData?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((ok, erro) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return erro(new Error("OBS desconectado"));
      const requestId = String(++this.seq);
      this.pendentes.set(requestId, { ok, erro });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
  }

  /** A fonte do vídeo na cena que está no ar; null se a cena não a tem. */
  private async itemNoAr(): Promise<{ cena: string; id: number; t: Transform } | null> {
    const c = await this.pedir("GetCurrentProgramScene");
    const cena = String(c.currentProgramSceneName ?? c.sceneName);
    try {
      const { sceneItemId } = await this.pedir("GetSceneItemId", { sceneName: cena, sourceName: this.cfg.fonte });
      const id = Number(sceneItemId);
      const r = await this.pedir("GetSceneItemTransform", { sceneName: cena, sceneItemId: id });
      return { cena, id, t: r.sceneItemTransform as Transform };
    } catch {
      return null;
    }
  }

  /** Mexe só em posição e escala: alinhamento, recorte e o resto da fonte ficam como estão. */
  private aplicar(o: Original, fator: number) {
    return this.pedir("SetSceneItemTransform", {
      sceneName: o.cena,
      sceneItemId: o.id,
      sceneItemTransform: {
        positionX: o.positionX * fator,
        positionY: o.positionY * fator,
        scaleX: o.scaleX * fator,
        scaleY: o.scaleY * fator,
      },
    });
  }

  private async animar(o: Original, destino: number, animar: boolean, vez: number) {
    const inicio = this.fator;
    const passos = animar ? Math.round(ANIMACAO_L_MS / 33) : 1;
    for (let n = 1; n <= passos; n++) {
      if (vez !== this.vez) return;
      this.fator = n === passos ? destino : inicio + (destino - inicio) * suave(n / passos);
      await this.aplicar(o, this.fator);
      if (n < passos) await new Promise((r) => setTimeout(r, 33));
    }
  }

  private async sincronizar(animar: boolean) {
    const vez = ++this.vez;
    try {
      const item = await this.itemNoAr();
      if (vez !== this.vez) return;

      if (!this.alvo) {
        // Fim do L: a cena do ar volta animada; as que ficaram para trás, direto.
        const noAr = item ? this.tocadas.get(item.cena) : undefined;
        for (const o of Array.from(this.tocadas.values())) if (o !== noAr) await this.aplicar(o, 1);
        if (noAr) await this.animar(noAr, 1, animar, vez);
        if (vez !== this.vez) return;
        this.fator = 1;
        this.tocadas.clear();
        this.guardar();
        this.aoMudar(item ? "conectado" : "sem-fonte");
        return;
      }

      if (!item) return this.aoMudar("sem-fonte");
      let o = this.tocadas.get(item.cena);
      if (!o) {
        if (!emTelaCheia(item.t, this.base)) return this.aoMudar("nao-cheia");
        const { positionX, positionY, scaleX, scaleY } = item.t;
        o = { cena: item.cena, id: item.id, positionX, positionY, scaleX, scaleY };
        this.tocadas.set(item.cena, o);
        this.guardar();
      }
      this.aoMudar("conectado");
      await this.animar(o, ESCALA_L, animar, vez);
    } catch {
      // OBS caiu no meio: ao reconectar, sincroniza de novo.
    }
  }
}
