# Fora da Caixa — Hub

Hub do ecossistema de conteúdo **Fora da Caixa** (Mogi Guaçu · SP): home com
episódios do YouTube atualizados automaticamente, os 5 quadros, números do
canal, página de parcerias e — o diferencial — **uma landing page por
parceiro** com **QR code** e **tracking de acessos**.

Stack: **Next.js 14** (App Router) · **Tailwind CSS** · **Supabase** (Postgres +
Auth) · deploy na **Vercel**.

## O que já funciona sem configuração nenhuma

- Home com hero dinâmico puxando os últimos vídeos do canal via **RSS do
  YouTube** (sem API key). Separa episódios de Shorts automaticamente.
- Todas as seções institucionais (quadros, números, história, parcerias).

Os recursos de **parceiros, tracking, QR e admin** precisam do Supabase.

## Setup

### 1. Instalar e rodar

```bash
npm install
cp .env.example .env.local   # preencha depois (passo 3)
npm run dev
```

### 2. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode **na ordem**:
   - [`supabase/schema.sql`](supabase/schema.sql) — tabelas `partners`,
     `partner_clicks`, `ig_highlights`, RLS e um parceiro de exemplo.
   - [`supabase/002_brand_kit.sql`](supabase/002_brand_kit.sql) — colunas do
     kit de marca (paleta + estilo visual) e o bucket `partner-assets`.
3. Em **Authentication → Users → Add user**, crie o usuário admin (e-mail +
   senha) que vai logar em `/admin`.

### 3. Preencher `.env.local`

Copie de **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # só no servidor, nunca no client
```

Reinicie o `npm run dev`.

### 4. Deploy na Vercel

1. Importe o repositório na Vercel.
2. Em **Settings → Environment Variables**, adicione as mesmas 3 variáveis.
3. Deploy. Pronto.

## Como usar (fluxo do parceiro)

1. Em `/admin`, clique **+ Novo parceiro** e preencha nome, tagline, descrição,
   logo, CTA e seções livres.
2. Na tela de edição do parceiro, **baixe o QR code** (PNG) e exiba na tela
   durante a live/episódio.
3. Quem escaneia vai para `/go/{slug}?src=qr` → o acesso é **registrado** → e é
   redirecionado para `/parceiros/{slug}` (a landing do parceiro).
4. No `/admin` você acompanha os acessos por parceiro (7 dias, 30 dias, via QR).

Links internos do site para o parceiro passam por `/go/{slug}?src=site`, então
o tracking distingue **QR** de **site**.

## Instagram

Não existe API pública/gratuita confiável para Stories. Os **destaques do
Instagram** na home são **curados manualmente** no `/admin` (imagem + link).

## Arquitetura (mapa rápido)

| Caminho | O quê |
|---|---|
| `src/lib/config.ts` | Marca, quadros, números do canal, links, WhatsApp |
| `src/lib/youtube.ts` | Feed RSS do YouTube (ISR 30 min) |
| `src/lib/partners.ts` | Leitura pública de parceiros + `recordClick` |
| `src/lib/admin.ts` | Dados do admin (parceiros com métricas) |
| `src/lib/supabase/*` | Clientes: `public`, `server`, `admin`, `client` |
| `src/lib/qr.ts` | Geração do QR + URL de tracking |
| `src/app/page.tsx` | Home (hub) |
| `src/app/parcerias/` | Página comercial / media kit |
| `src/app/parceiros/[slug]/` | Landing pública de cada parceiro |
| `src/app/go/[slug]/route.ts` | Endpoint de tracking do QR (log + redirect) |
| `src/app/admin/` | Painel: login, dashboard, CRUD, QR |
| `src/middleware.ts` | Protege `/admin` (Supabase Auth) |
| `supabase/schema.sql` | Schema + RLS |

## Atualizar os números do canal

Edite `channelStats` em [`src/lib/config.ts`](src/lib/config.ts).
