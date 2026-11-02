import "server-only";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { clearConfig, getConfig, setConfig } from "@/lib/producao/store";
import { tokenRequest } from "@/lib/producao/youtube-api";
import { TZ, linkConvidado, type Convidado, type Episodio } from "./store";

/**
 * Google Calendar com conexão própria, separada da do YouTube: o canal
 * costuma ser uma Conta de Marca, que não tem agenda. Mesmo client OAuth
 * (GOOGLE_CLIENT_ID), outro refresh token.
 *
 * Cada episódio confirmado vira um evento com o convidado e a equipe como
 * participantes; o Google manda o convite e os lembretes por e-mail.
 */
const SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3";

const K = { refresh: "gcal_refresh_token", account: "gcal_account", calendar: "gcal_calendar_id", equipe: "agenda_equipe" };

export function gcalAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function connectCalendar(code: string, redirectUri: string): Promise<string> {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("O Google não devolveu refresh_token. Remova o acesso e conecte de novo.");
  const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${t.access_token}` },
    cache: "no-store",
  }).then((r) => r.json() as Promise<{ email?: string }>);
  await setConfig(K.refresh, t.refresh_token);
  await setConfig(K.account, me.email ?? "conta Google");
  cached = null;
  return me.email ?? "conta Google";
}

export async function disconnectCalendar(): Promise<void> {
  await clearConfig(K.refresh);
  await clearConfig(K.account);
  cached = null;
}

export const calendarAccount = () => getConfig(K.account);
export const calendarId = async () => (await getConfig(K.calendar)) || "primary";

/** E-mails da equipe convidados para todo episódio (separados por vírgula). */
export async function equipeEmails(): Promise<string[]> {
  return ((await getConfig(K.equipe)) ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const refresh = await getConfig(K.refresh);
  if (!refresh) throw new Error("Google Calendar não conectado (/admin/agenda/config).");
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  cached = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

async function gcal<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  // Evento já apagado do lado de lá: para nós, missão cumprida.
  if (init.method === "DELETE" && (res.status === 404 || res.status === 410)) return undefined as T;
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
}

function eventBody(ep: Episodio, convidados: Convidado[], equipe: string[], youtubeUrl: string | null) {
  const quadro = isQuadroId(ep.quadro) ? QUADROS[ep.quadro].name : ep.quadro;
  const nomes = convidados.map((c) => c.nome).join(", ") || "convidado";
  const inicio = new Date(ep.inicio);
  const fim = new Date(inicio.getTime() + ep.duracao_min * 60_000);
  const emails = new Set<string>(equipe);
  for (const c of convidados) if (c.email) emails.add(c.email.toLowerCase());

  const description = [
    `Gravação do ${quadro} com ${nomes}.`,
    ep.tema && `Tema: ${ep.tema}`,
    youtubeUrl && `Live no YouTube: ${youtubeUrl}`,
    ...convidados.map((c) => `Briefing de ${c.nome}: ${linkConvidado(c.token)}`),
    "Chegue 20 minutos antes para passar o som. Dúvidas: responda este convite ou chame a produção no WhatsApp.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    summary: `${quadro} · ${nomes}`,
    description,
    start: { dateTime: inicio.toISOString(), timeZone: TZ },
    end: { dateTime: fim.toISOString(), timeZone: TZ },
    attendees: Array.from(emails).map((email) => ({ email })),
    reminders: { useDefault: false, overrides: [{ method: "email", minutes: 24 * 60 }, { method: "popup", minutes: 120 }] },
  };
}

/** Cria ou atualiza o evento do episódio. Devolve o id do evento. */
export async function upsertEvent(ep: Episodio, convidados: Convidado[], youtubeUrl: string | null): Promise<string> {
  const cal = encodeURIComponent(await calendarId());
  const body = JSON.stringify(eventBody(ep, convidados, await equipeEmails(), youtubeUrl));
  if (ep.gcal_event_id) {
    const r = await gcal<{ id: string }>(`/calendars/${cal}/events/${ep.gcal_event_id}?sendUpdates=all`, {
      method: "PUT",
      body,
    });
    return r.id;
  }
  const r = await gcal<{ id: string }>(`/calendars/${cal}/events?sendUpdates=all`, { method: "POST", body });
  return r.id;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const cal = encodeURIComponent(await calendarId());
  await gcal(`/calendars/${cal}/events/${eventId}?sendUpdates=all`, { method: "DELETE" });
}
