#!/usr/bin/env node
/**
 * Copia os arquivos do Supabase Storage para o Cloudflare R2.
 *
 *   node scripts/migrar-storage-r2.mjs            # copia (só o que falta ou mudou de tamanho)
 *   node scripts/migrar-storage-r2.mjs --conferir # só compara, não copia
 *   node scripts/migrar-storage-r2.mjs --urls     # depois do deploy: troca as URLs dos logos/capas em `partners`
 *
 * Cada bucket do Supabase vira um prefixo no bucket do R2 (producao/…,
 * client-files/…, partner-assets/…), igual a src/lib/storage.ts. Nada é
 * apagado do Supabase: ele fica de reserva até a conferência final.
 * Lê as variáveis do .env.local.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
  if (!env[k]) throw new Error(`${k} ausente no .env.local`);
}

const BUCKETS = ["producao", "client-files", "partner-assets"];
const conferir = process.argv.includes("--conferir");
const urls = process.argv.includes("--urls");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

/** Lista recursiva: no Storage, pasta vem com id null. */
async function listar(bucket, prefixo = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefixo, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${bucket}/${prefixo}: ${error.message}`);
    for (const o of data) {
      const path = prefixo ? `${prefixo}/${o.name}` : o.name;
      if (o.id === null) out.push(...(await listar(bucket, path)));
      else if (o.name !== ".emptyFolderPlaceholder") out.push({ path, size: o.metadata?.size ?? null, mime: o.metadata?.mimetype ?? null });
    }
    if (data.length < 1000) return out;
  }
}

async function tamanhoNoR2(key) {
  try {
    return (await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))).ContentLength ?? 0;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

async function migrar() {
  const total = { arquivos: 0, copiados: 0, iguais: 0, faltando: 0, falhas: 0, bytes: 0 };
  for (const bucket of BUCKETS) {
    const objetos = await listar(bucket);
    console.log(`\n${bucket}: ${objetos.length} arquivo(s)`);
    const fila = [...objetos];
    const trabalhar = async () => {
      for (let o = fila.shift(); o; o = fila.shift()) {
        total.arquivos++;
        const key = `${bucket}/${o.path}`;
        try {
          const noR2 = await tamanhoNoR2(key);
          if (noR2 !== null && (o.size === null || noR2 === o.size)) {
            total.iguais++;
            continue;
          }
          if (conferir) {
            total.faltando++;
            console.log(`  falta ${key}${noR2 !== null ? ` (R2 ${noR2} B, Supabase ${o.size} B)` : ""}`);
            continue;
          }
          const { data, error } = await sb.storage.from(bucket).download(o.path);
          if (error || !data) throw new Error(error?.message ?? "sem dados");
          const buf = Buffer.from(await data.arrayBuffer());
          await r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: buf, ContentType: o.mime ?? data.type ?? "application/octet-stream" }));
          total.copiados++;
          total.bytes += buf.length;
        } catch (e) {
          total.falhas++;
          console.log(`  FALHA ${key}: ${e.message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, trabalhar));
  }
  console.log(
    `\n${total.arquivos} arquivo(s): ${total.copiados} copiado(s) (${(total.bytes / 1024 / 1024).toFixed(1)} MB), ${total.iguais} já no R2` +
      (conferir ? `, ${total.faltando} faltando` : "") +
      `, ${total.falhas} falha(s).`
  );
  if (total.falhas || total.faltando) process.exitCode = 1;
}

/** Logos e capas: URL pública do Supabase → rota /arquivos do site (ou R2_PUBLIC_BASE). */
async function trocarUrls() {
  const site = (env.NEXT_PUBLIC_SITE_URL || "https://www.pfctv.com.br").replace(/\/+$/, "");
  const base = env.R2_PUBLIC_BASE?.replace(/\/+$/, "") || `${site}/arquivos`;
  const antigo = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/partner-assets/`;
  const { data, error } = await sb.from("partners").select("id, slug, logo_url, cover_url");
  if (error) throw new Error(error.message);
  let n = 0;
  for (const p of data) {
    const patch = {};
    for (const c of ["logo_url", "cover_url"]) {
      if (p[c]?.startsWith(antigo)) {
        const path = decodeURIComponent(p[c].slice(antigo.length));
        if ((await tamanhoNoR2(`partner-assets/${path}`)) === null) throw new Error(`${p.slug}: ${path} não está no R2. Rode a cópia antes.`);
        patch[c] = `${base}/partner-assets/${path}`;
      }
    }
    if (Object.keys(patch).length) {
      const { error: e } = await sb.from("partners").update(patch).eq("id", p.id);
      if (e) throw new Error(`${p.slug}: ${e.message}`);
      console.log(`  ${p.slug}: ${Object.keys(patch).join(", ")}`);
      n++;
    }
  }
  console.log(`${n} parceiro(s) atualizado(s).`);
}

await (urls ? trocarUrls() : migrar());
