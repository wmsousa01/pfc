# Fluxo de parceria — do "sim" ao lead entregue

Como um parceiro entra no ecossistema PFC, ganha página própria e passa a
receber lead qualificado. O exemplo trabalhado é a **Geladeiras e Cia**
(`/parceiros/geladeiras-e-cia`), primeiro parceiro com o fluxo completo.

---

## 1. Antes de cadastrar: o kit de marca

Crie `assets/partners/<slug>/` e peça ao parceiro:

| Item | Formato | Para que serve |
|---|---|---|
| Logo | SVG, ou PNG ≥1000px com fundo transparente | topo da página, vitrine, admin |
| Capa | JPG/PNG 1600×900 (showroom, equipe, produto real) | fundo do hero e imagem de compartilhamento |
| WhatsApp oficial | número que **realmente** atende | destino do lead |
| Instagram | handle | bloco de contato |

Documente tudo em `assets/partners/<slug>/brand.md` — cores em hex (amostre do
logo, não do "achismo"), links, horário, endereço e o cliente ideal dele.
As cores viram a identidade da página inteira: primária, secundária e fundo.

> A paleta passa por checagem de contraste em runtime (`buildPartnerTheme`).
> Se a cor da marca não for legível como texto sobre o fundo dela, o site
> clareia só o texto — a cor de botão e de destaque continua a da marca.

## 2. Cadastro

Duas formas:

- **Admin** (`/admin/parceiros/new`): kit de marca com prévia ao vivo, contato
  e seções livres. É o caminho para o dia a dia.
- **Script de seed** (`scripts/seed-<slug>.mjs`): sobe assets e grava o
  conteúdo rico (`content`) de uma vez. É o caminho quando a página tem
  produtos, FAQ, números e triagem — como a da Geladeiras e Cia.

```bash
node scripts/seed-geladeiras-e-cia.mjs
```

O script imprime os três links do parceiro: **página**, **QR** e **painel**.

### O que é o `content`

Coluna `jsonb` em `partners` (tipo `PartnerContent` em `src/lib/types.ts`).
Cada bloco só aparece se existir — parceiro simples continua com a página
enxuta de antes:

`eyebrow` · `highlights` · `stats` · `products` · `perks` · `steps` · `faq` ·
`address` · `hours` · `whatsapp_message` · `triage`

## 3. A página

`/parceiros/<slug>` — inteira na marca do parceiro (cor, fonte, cantos, brilho),
com hero, faixa de números, produtos, diferenciais, como funciona, triagem,
FAQ, contato e assinatura do PFC. Barra fixa de CTA no celular.

O botão flutuante de WhatsApp do PFC **some** quando o parceiro tem triagem
ativa: dois WhatsApps na mesma tela dividem o clique de quem ia comprar.

## 4. Triagem: como o lead chega qualificado

Cinco perguntas de um toque + contato. O que ele responde vira qualificação:

| Pergunta | O que qualifica |
|---|---|
| O que precisa gelar? | intenção definida vs. curioso |
| Alugar ou comprar? | recorrência vs. venda única |
| Onde vai ficar? | é o cliente ideal do parceiro? |
| Quantos? | tamanho do negócio |
| Para quando? | **peso maior** — separa comprador de pesquisador |

Resultado: **score de 0 a 100** e temperatura (🔥 quente ≥70 · 🌤 morno ≥45 ·
❄ frio). Regras em `src/lib/lead-triage.ts`.

O lead é **sempre gravado** em `partner_leads` e só então o site oferece o
WhatsApp do parceiro **com o briefing já escrito** — equipamento, volume,
modalidade, prazo, bairro e observação. Ele responde orçamento, não "oi, tudo
bem?".

> Se um dia a triagem for para dentro do WhatsApp (via Cloud API), o bot deve
> montar o mesmo `TriageAnswers` e chamar `scoreLead`. A pontuação não se
> duplica.

## 5. Rastreio de origem

`/go/<slug>?src=qr` registra o acesso e leva para a página mantendo o `src`.
O formulário lê esse parâmetro no navegador e carimba a origem no lead — dá
para dizer **quantos leads o QR do episódio gerou**, não só quantos cliques.

## 6. Painel do parceiro

`/parceiros/<slug>/painel?token=<uuid>` — link secreto, somente leitura, fora
do índice dos buscadores. Ele vê leads (com temperatura, qualificação e botão
de chamar no WhatsApp), acessos totais, acessos via QR e a série dos 30 dias.

O token fica em `partner_panels`, **nunca** em `partners` — essa tabela tem
leitura pública dos ativos e o token vazaria para qualquer visitante.
Copie o link em `/admin/parceiros/<id>`.

## 7. Acompanhamento no PFC

`/admin/parceiros/<id>` mostra QR, acessos, resumo de leads (total, quentes,
7 dias) e a lista completa com origem e se o lead chegou a abrir o WhatsApp do
parceiro. É o material da conversa de renovação.

---

## Checklist de um parceiro novo

- [ ] Assets e `brand.md` em `assets/partners/<slug>/`
- [ ] Migração `006` aplicada no Supabase
- [ ] Parceiro cadastrado (admin ou seed) com WhatsApp preenchido
- [ ] Página revisada no celular (é onde o lead chega)
- [ ] QR baixado e inserido na arte do episódio
- [ ] Link do painel enviado ao parceiro, com o aviso de não compartilhar
- [ ] Combinado com ele o SLA de resposta ao lead quente (ideal: 15 min)
