#!/usr/bin/env node
// Sincroniza o canvas vertical do Aitum Vertical com a cena principal do OBS (Node 22, sem dependências).
// Quando o programa troca para a cena "X", o canvas vertical troca para "X Vertical", se ela existir.
// Cenas sem par vertical não mexem no vertical.
//
// Uso (na raiz do projeto, antes da live, e deixe a janela aberta):
//   node scripts/obs/sincronizar-vertical.mjs
//   node scripts/obs/sincronizar-vertical.mjs --sufixo " Vertical"     (padrão)
//
// Só lê eventos e troca a cena do canvas vertical (vendor aitum-vertical-canvas / switch_scene).
// Não altera fontes, configurações, transmissão nem gravação. Reconecta sozinho se o OBS fechar e voltar.
//
// Senha: variável OBS_SENHA, ou OBS_WEBSOCKET_SENHA no .env.local (fora do git). Nunca é impressa.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORTA = Number(process.env.OBS_PORTA) || 4455;
const VENDOR = "aitum-vertical-canvas";
const CANVAS = "Aitum Vertical";
const iSufixo = process.argv.indexOf("--sufixo");
const SUFIXO = iSufixo > 0 ? process.argv[iSufixo + 1] ?? " Vertical" : " Vertical";

// Bits de eventSubscriptions do obs-websocket v5: Config (1<<1) e Scenes (1<<2).
const EVENTOS = (1 << 1) | (1 << 2);

function senha() {
  if (process.env.OBS_SENHA) return process.env.OBS_SENHA;
  for (const f of [".env.local", "../../.env.local"].map((p) => path.resolve(process.cwd(), p))) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, "utf8").match(/^OBS_WEBSOCKET_SENHA\s*=\s*"?([^"\r\n]*)"?/m);
    if (m) return m[1];
  }
  return "";
}

const b64 = (s) => createHash("sha256").update(s).digest("base64");
const hora = () => new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
const log = (msg) => console.log(`[${hora()}] ${msg}`);

function conectar(aoEvento) {
  return new Promise((pronto, falhou) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORTA}`, "obswebsocket.json");
    let seq = 0;
    let ok = false;
    const pend = new Map();
    const pedir = (requestType, requestData) =>
      new Promise((res, rej) => {
        const requestId = "s" + ++seq;
        pend.set(requestId, { res, rej });
        ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      });
    ws.onerror = () => !ok && falhou(new Error(`OBS não respondeu em 127.0.0.1:${PORTA}.`));
    ws.onclose = (e) => {
      for (const p of pend.values()) p.rej(new Error("conexão fechada"));
      pend.clear();
      if (!ok) falhou(new Error(e.code === 4009 ? "Senha do WebSocket recusada. Confira OBS_SENHA / OBS_WEBSOCKET_SENHA." : "conexão fechada"));
      else aoEvento({ eventType: "__fechou" });
    };
    ws.onmessage = (m) => {
      const { op, d } = JSON.parse(String(m.data));
      if (op === 0) {
        const auth = d.authentication;
        if (auth && !senha()) return falhou(new Error("O OBS pede senha: defina OBS_SENHA ou OBS_WEBSOCKET_SENHA no .env.local."));
        ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, eventSubscriptions: EVENTOS, authentication: auth ? b64(b64(senha() + auth.salt) + auth.challenge) : undefined } }));
      } else if (op === 2) {
        ok = true;
        pronto({ pedir });
      } else if (op === 5) aoEvento(d);
      else if (op === 7) {
        const p = pend.get(d.requestId);
        if (!p) return;
        pend.delete(d.requestId);
        d.requestStatus.result ? p.res(d.responseData ?? {}) : p.rej(new Error(`${d.requestType}: ${d.requestStatus.comment ?? d.requestStatus.code}`));
      }
    };
  });
}

async function cenasVerticais(obs) {
  const r = await obs.pedir("CallVendorRequest", { vendorName: VENDOR, requestType: "get_scenes", requestData: {} });
  return new Set((r.responseData?.scenes ?? []).map((s) => s.name));
}

async function sincronizar(obs, cenaPrincipal, motivo) {
  if (!cenaPrincipal || cenaPrincipal.endsWith(SUFIXO)) return;
  const alvo = cenaPrincipal + SUFIXO;
  const verticais = await cenasVerticais(obs);
  if (!verticais.has(alvo)) return log(`"${cenaPrincipal}" sem par vertical ("${alvo}" não existe): vertical mantido`);
  await obs.pedir("CallVendorRequest", { vendorName: VENDOR, requestType: "switch_scene", requestData: { scene: alvo } });
  log(`${motivo}: "${cenaPrincipal}" -> vertical "${alvo}"`);
}

async function principalUuid(obs) {
  const { canvases = [] } = await obs.pedir("GetCanvasList").catch(() => ({}));
  return {
    main: canvases.find((c) => c.canvasFlags?.MAIN)?.canvasUuid,
    vertical: canvases.find((c) => c.canvasName === CANVAS)?.canvasUuid,
  };
}

async function rodar() {
  let obs;
  let canvas = {};
  let fila = Promise.resolve();
  const enfileirar = (fn) => (fila = fila.then(fn).catch((e) => log(`erro: ${e.message}`)));
  let fechou;
  const caiu = new Promise((r) => (fechou = r));

  obs = await conectar((ev) => {
    if (ev.eventType === "__fechou") return fechou();
    const dados = ev.eventData ?? {};
    if (ev.eventType === "CurrentProgramSceneChanged") {
      // Eventos de outro canvas (ex.: o próprio vertical) não disparam sincronização.
      if (dados.canvasUuid && canvas.main && dados.canvasUuid !== canvas.main) return;
      enfileirar(() => sincronizar(obs, dados.sceneName, "troca"));
    } else if (ev.eventType === "CurrentSceneCollectionChanged") {
      enfileirar(async () => {
        canvas = await principalUuid(obs);
        const { currentProgramSceneName } = await obs.pedir("GetCurrentProgramScene");
        await sincronizar(obs, currentProgramSceneName, `coleção "${dados.sceneCollectionName}"`);
      });
    }
  });

  canvas = await principalUuid(obs);
  const v = await obs.pedir("CallVendorRequest", { vendorName: VENDOR, requestType: "version", requestData: {} }).catch(() => null);
  if (!v) throw new Error("Aitum Vertical não respondeu (vendor aitum-vertical-canvas). Ele está instalado e carregado?");
  const { currentSceneCollectionName } = await obs.pedir("GetSceneCollectionList");
  log(`conectado · Aitum Vertical ${v.responseData?.version} · coleção "${currentSceneCollectionName}" · par: "X" -> "X${SUFIXO}"`);
  const { currentProgramSceneName } = await obs.pedir("GetCurrentProgramScene");
  await sincronizar(obs, currentProgramSceneName, "início");
  log("aguardando trocas de cena (Ctrl+C para sair)");
  await caiu;
  log("OBS desconectou; tentando de novo em 5 s");
}

for (;;) {
  try {
    await rodar();
  } catch (e) {
    log(e.message);
    if (/Senha|pede senha/.test(e.message)) process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
