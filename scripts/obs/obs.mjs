#!/usr/bin/env node
// Ferramenta do OBS para o agente obs-config (Node 22, sem dependências).
// Fala com o obs-websocket v5 em 127.0.0.1 (o OBS do estúdio roda nesta máquina).
//
// Senha: variável OBS_SENHA, ou OBS_WEBSOCKET_SENHA no .env.local (fora do git).
// Nunca é impressa: nas URLs das fontes, o que vem depois de #obs= sai como ***.
//
// Comandos:
//   status                         versão, coleção, cena no ar, transmitindo/gravando
//   cenas [--detalhe]              cenas e fontes de cima para baixo (com --detalhe: posição, escala, arquivo/URL)
//   backup <rótulo>                estado completo + arquivos de coleção em %APPDATA%\obs-studio\basic\scenes\backup-<data>-<rótulo>
//   captura <cena> <arquivo.png> [--mostrar]
//                                  imagem da cena; --mostrar põe a cena no programa por alguns segundos
//                                  (fonte de navegador só desenha em cena exibida) e volta
//   req <Tipo> ['<json>']          um pedido cru; os que não começam com Get exigem OBS parado
//   lote <arquivo.json>            lista de pedidos [{ "requestType": "...", "requestData": {...} }],
//                                  em ordem; exige OBS parado e um backup feito antes
//   recarregar <fonte>             recarrega uma fonte de navegador (sem cache)
//
// Regras embutidas: nada que altera roda com transmissão ou gravação ativas; o lote para no primeiro erro.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORTA = Number(process.env.OBS_PORTA) || 4455;

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
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const mascarar = (u) => String(u ?? "").replace(/(#obs=)[^&]*/, "$1***");
const sair = (msg, codigo = 1) => {
  console.error(msg);
  process.exit(codigo);
};

function conectar() {
  return new Promise((pronto, falhou) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORTA}`, "obswebsocket.json");
    let seq = 0;
    const pend = new Map();
    const pedir = (requestType, requestData) =>
      new Promise((ok, no) => {
        const requestId = "o" + ++seq;
        pend.set(requestId, { ok, no });
        ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      });
    const caiu = (motivo) => falhou(new Error(motivo));
    ws.onerror = () => caiu(`OBS não respondeu em 127.0.0.1:${PORTA}. O OBS está aberto e com o servidor WebSocket ativado?`);
    ws.onclose = (e) => e.code === 4009 && caiu("Senha do WebSocket recusada. Confira OBS_SENHA / OBS_WEBSOCKET_SENHA.");
    ws.onmessage = (m) => {
      const { op, d } = JSON.parse(String(m.data));
      if (op === 0) {
        const auth = d.authentication;
        if (auth && !senha()) return caiu("O OBS pede senha: defina OBS_SENHA ou OBS_WEBSOCKET_SENHA no .env.local.");
        ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, eventSubscriptions: 0, authentication: auth ? b64(b64(senha() + auth.salt) + auth.challenge) : undefined } }));
      } else if (op === 2) pronto({ pedir, fechar: () => ws.close() });
      else if (op === 7) {
        const p = pend.get(d.requestId);
        pend.delete(d.requestId);
        d.requestStatus.result ? p.ok(d.responseData ?? {}) : p.no(new Error(`${d.requestType}: ${d.requestStatus.comment ?? d.requestStatus.code}`));
      }
    };
  });
}

async function noAr(obs) {
  const [st, rec] = await Promise.all([obs.pedir("GetStreamStatus"), obs.pedir("GetRecordStatus")]);
  return st.outputActive || rec.outputActive;
}

async function exigirParado(obs) {
  if (await noAr(obs)) sair("Bloqueado: o OBS está transmitindo ou gravando. Nada foi alterado.", 2);
}

const ehLeitura = (tipo) => /^Get/.test(tipo);

function detalheDaFonte(s) {
  if (!s) return "";
  if (s.local_file) return `arquivo ${path.basename(s.local_file)}${s.looping ? " (loop)" : ""}`;
  if (s.file) return `imagem ${path.basename(s.file)}`;
  if (s.url) return `url ${mascarar(s.url)}`;
  if (s.video_device_id) return `câmera ${String(s.video_device_id).split(":")[0]}`;
  if (s.window) return `janela ${String(s.window).split(":")[0]}`;
  if (s.device_id) return `áudio ${s.device_id}`;
  return "";
}

const comandos = {
  async status(obs) {
    const [v, col, cena, st, rec, vid] = await Promise.all(
      ["GetVersion", "GetSceneCollectionList", "GetCurrentProgramScene", "GetStreamStatus", "GetRecordStatus", "GetVideoSettings"].map((t) => obs.pedir(t))
    );
    console.log(`OBS ${v.obsVersion} · websocket ${v.obsWebSocketVersion} · canvas ${vid.baseWidth}x${vid.baseHeight}`);
    console.log(`coleção: ${col.currentSceneCollectionName}  (todas: ${col.sceneCollections.join(", ")})`);
    console.log(`cena no ar: ${cena.currentProgramSceneName}`);
    console.log(`transmitindo: ${st.outputActive ? "SIM" : "não"} · gravando: ${rec.outputActive ? "SIM" : "não"}`);
  },

  async cenas(obs, args) {
    const detalhe = args.includes("--detalhe");
    const { scenes, currentProgramSceneName } = await obs.pedir("GetSceneList");
    const ajustes = {};
    if (detalhe) for (const i of (await obs.pedir("GetInputList")).inputs) ajustes[i.inputName] = (await obs.pedir("GetInputSettings", { inputName: i.inputName })).inputSettings;
    for (const c of [...scenes].reverse()) {
      console.log(`\n== ${c.sceneName}${c.sceneName === currentProgramSceneName ? "  (no ar)" : ""}`);
      const { sceneItems } = await obs.pedir("GetSceneItemList", { sceneName: c.sceneName });
      for (const i of [...sceneItems].reverse()) {
        const t = i.sceneItemTransform;
        const base = `  ${i.sceneItemEnabled ? "ON " : "off"} ${i.sourceName}`;
        if (!detalhe) console.log(base);
        else
          console.log(
            `${base.padEnd(42)} ${i.inputKind ?? "cena"} pos=${Math.round(t.positionX)},${Math.round(t.positionY)} esc=${t.scaleX.toFixed(3)}` +
              (t.boundsType !== "OBS_BOUNDS_NONE" ? ` caixa=${Math.round(t.boundsWidth)}x${Math.round(t.boundsHeight)}` : "") +
              ` ${detalheDaFonte(ajustes[i.sourceName])}`
          );
      }
    }
  },

  async backup(obs, [rotulo]) {
    if (!rotulo) sair("Uso: backup <rótulo>");
    const col = await obs.pedir("GetSceneCollectionList");
    const { scenes } = await obs.pedir("GetSceneList");
    const { inputs } = await obs.pedir("GetInputList");
    const data = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const pasta = path.join(process.env.APPDATA ?? ".", "obs-studio", "basic", "scenes", `backup-${data}-${rotulo.replace(/[^\w-]+/g, "-")}`);
    fs.mkdirSync(pasta, { recursive: true });
    const dump = { colecao: col.currentSceneCollectionName, quando: new Date().toISOString(), cenas: {}, fontes: {} };
    for (const c of scenes) dump.cenas[c.sceneName] = (await obs.pedir("GetSceneItemList", { sceneName: c.sceneName })).sceneItems;
    for (const i of inputs) dump.fontes[i.inputName] = { kind: i.inputKind, settings: (await obs.pedir("GetInputSettings", { inputName: i.inputName })).inputSettings };
    fs.writeFileSync(path.join(pasta, "estado.json"), JSON.stringify(dump, null, 2));
    const origem = path.dirname(pasta);
    for (const f of fs.readdirSync(origem)) if (f.endsWith(".json")) fs.copyFileSync(path.join(origem, f), path.join(pasta, f));
    console.log(`backup da coleção "${col.currentSceneCollectionName}" em ${pasta}`);
  },

  async captura(obs, [cena, arquivo, ...resto]) {
    if (!cena || !arquivo) sair("Uso: captura <cena> <arquivo.png> [--mostrar]");
    let antes = null;
    try {
      if (resto.includes("--mostrar")) {
        if (await noAr(obs)) sair("--mostrar trocaria a cena no ar durante a transmissão: bloqueado.", 2);
        antes = (await obs.pedir("GetCurrentProgramScene")).currentProgramSceneName;
        if (antes !== cena) await obs.pedir("SetCurrentProgramScene", { sceneName: cena });
        await dorme(10000);
      }
      const s = await obs.pedir("GetSourceScreenshot", { sourceName: cena, imageFormat: "png", imageWidth: 1280 });
      fs.writeFileSync(arquivo, Buffer.from(s.imageData.split(",")[1], "base64"));
      console.log(`captura de "${cena}" em ${path.resolve(arquivo)}`);
    } finally {
      if (antes && antes !== cena) {
        await obs.pedir("SetCurrentProgramScene", { sceneName: antes });
        console.log(`programa voltou para "${antes}"`);
      }
    }
  },

  async req(obs, [tipo, json]) {
    if (!tipo) sair("Uso: req <Tipo> ['<json>']");
    if (!ehLeitura(tipo)) await exigirParado(obs);
    const r = await obs.pedir(tipo, json ? JSON.parse(json) : undefined);
    console.log(mascarar(JSON.stringify(r, null, 2)));
  },

  async lote(obs, [arquivo]) {
    if (!arquivo) sair("Uso: lote <arquivo.json>");
    const pedidos = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    if (!Array.isArray(pedidos)) sair("O lote precisa ser uma lista de { requestType, requestData }.");
    if (pedidos.some((p) => !ehLeitura(p.requestType))) await exigirParado(obs);
    for (const [n, p] of pedidos.entries()) {
      try {
        const r = await obs.pedir(p.requestType, p.requestData);
        console.log(`${n + 1}. ok   ${p.requestType}${Object.keys(r).length ? " " + mascarar(JSON.stringify(r)).slice(0, 160) : ""}`);
      } catch (e) {
        sair(`${n + 1}. ERRO ${e.message}\nLote parado aqui: os pedidos anteriores já foram aplicados.`);
      }
    }
  },

  async recarregar(obs, [fonte]) {
    if (!fonte) sair("Uso: recarregar <fonte>");
    await obs.pedir("PressInputPropertiesButton", { inputName: fonte, propertyName: "refreshnocache" });
    console.log(`"${fonte}" recarregada`);
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!comandos[cmd]) sair(`Comandos: ${Object.keys(comandos).join(", ")}. Veja o topo de scripts/obs/obs.mjs.`);
const obs = await conectar().catch((e) => sair(e.message));
try {
  await comandos[cmd](obs, args);
} catch (e) {
  sair("ERRO: " + e.message);
} finally {
  obs.fechar();
}
process.exit(0);
