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
   - [`supabase/003_leads.sql`](supabase/003_leads.sql) — tabela `leads`
     (formulário de media kit em `/parcerias`) e RLS.
   - [`supabase/004_revendedores.sql`](supabase/004_revendedores.sql) — papel de
     admin (`app_admins`), `products`, `resellers`, `orders`, `order_items` e o
     reaperto das policies antigas.
   - [`supabase/005_desconto_e_privacidade.sql`](supabase/005_desconto_e_privacidade.sql)
     — desconto do cupom (`resellers.discount_percent`, `orders.discount_cents`)
     e o fim da leitura direta da tabela `orders` pelo revendedor, para não
     expor o custo de produção nem o contato do cliente.
   - [`supabase/006_parceiro_leads.sql`](supabase/006_parceiro_leads.sql) —
     conteúdo rico da landing do parceiro (`partners.content`, `whatsapp`,
     `instagram`, `city`), a tabela `partner_leads` (triagem qualificada) e
     `partner_panels` (token do painel read-only do parceiro).
   - [`supabase/007_painel_revendedor_rpc.sql`](supabase/007_painel_revendedor_rpc.sql)
     — troca as views do painel do revendedor por funções
     `reseller_orders()` / `reseller_order_items()`. Mesmas colunas, mesmo
     filtro; sai do lint `security_definer_view` do advisor.
3. Em **Authentication → Users → Add user**, crie o usuário admin (e-mail +
   senha) que vai logar em `/admin`.

> **Ordem importa na 004.** Ela promove a admin **todos os usuários que já
> existem** no momento em que roda. Se você criar o admin depois, adicione-o na
> mão:
>
> ```sql
> insert into public.app_admins (user_id)
> select id from auth.users where email = 'seu@email.com'
> on conflict do nothing;
> ```
>
> Sem isso o painel abre, mas as tabelas vêm vazias — a RLS passou a exigir o
> papel de admin, e não só "estar logado".

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

## Loja e revendedores

A `/loja` vende por **pedido no site** (sem gateway de pagamento): o cliente monta
o pedido, o registro cai no banco e a confirmação de valor, prazo e pagamento
acontece no WhatsApp.

**Revendedor** é quem indica venda: apresentador de quadro, influencer ou
parceiro. Cada um tem um `slug` que vira duas coisas:

- **link** `pfctv.com.br/r/{slug}` — leva à loja com o cupom aplicado e
  deixa um cookie de 30 dias (a venda continua creditada se o cliente voltar
  depois);
- **cupom** `{SLUG}` — para quem digita no checkout.

### Comissão

Por revendedor, escolhida no cadastro:

| Tipo | Cálculo |
|---|---|
| `percent` | % sobre o valor do pedido |
| `fixed` | R$ fixo por peça vendida |

O valor é **congelado no pedido** no momento da venda — mudar a regra depois não
reescreve comissões já geradas. Um pedido só entra em **"a repassar"** quando
está `entregue` **e** `pago`; o botão *Marcar como repassado* fecha o acerto (no
lote do revendedor ou pedido a pedido).

**Lucro líquido** = faturamento − custo de produção − comissões, ignorando
cancelados. O custo vem de `/admin/produtos` — se ele estiver zerado, o lucro
exibido é só o faturamento menos a comissão.

### Fluxo

1. `/admin/produtos` — ajuste **preço e custo** (a 004 entra com valores de
   exemplo).
2. `/admin/revendedores` → **+ Novo revendedor** — nome, slug, regra de comissão
   e, opcionalmente, **e-mail + senha** para criar o acesso dele.
3. Entregue a ele o link, o cupom ou o **QR** (baixável em PNG).
4. Os pedidos caem em `/admin/pedidos`: você move a **entrega**
   (novo → confirmado → produção → pronto → entregue) e o **pagamento**.
5. Ele acompanha tudo em `/revendedor` — vendas, status de cada entrega, quanto
   já recebeu e quanto tem a receber.

### Papéis e acesso

Depois da 004, "estar logado" **não** é mais sinônimo de admin:

- **admin** — quem está em `app_admins`; acessa `/admin`.
- **revendedor** — quem tem cadastro ativo em `resellers` com `user_id`; acessa
  `/revendedor` e, pela RLS, enxerga **apenas os pedidos dele**.
- conta sem nenhum dos dois cai em `/sem-acesso`.

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
| `src/lib/auth.ts` | Papel da sessão + gates `requireAdmin` / `requireReseller` |
| `src/lib/shop.ts` | Leitura pública da loja + resolução de cupom/link |
| `src/lib/orders.ts` | Pedidos, revendedores e consolidação de números |
| `src/lib/commission.ts` | Cálculo da comissão e cupom |
| `src/lib/money.ts` | Dinheiro em centavos (`brl`, `toCents`) |
| `src/lib/supabase/*` | Clientes: `public`, `server`, `admin`, `client` |
| `src/lib/qr.ts` | Geração do QR + URL de tracking |
| `src/app/page.tsx` | Home (hub) |
| `src/app/parcerias/` | Página comercial / media kit |
| `src/app/parceiros/[slug]/` | Landing pública de cada parceiro |
| `src/app/go/[slug]/route.ts` | Endpoint de tracking do QR (log + redirect) |
| `src/app/loja/` | Loja pública + server action que registra o pedido |
| `src/app/r/[slug]/route.ts` | Link do revendedor (aplica cupom + cookie) |
| `src/app/admin/` | Painel: parceiros, pedidos, revendedores, produtos |
| `src/app/revendedor/` | Área do revendedor (login + painel) |
| `src/middleware.ts` | Protege `/admin` e `/revendedor` (Supabase Auth) |
| `supabase/schema.sql` | Schema + RLS |

## Atualizar os números do canal

Edite `channelStats` em [`src/lib/config.ts`](src/lib/config.ts).
