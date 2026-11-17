# PFCTV Ads — fase 1: Oferta da semana

Produto self-serve (low touch) para a faixa C: pequeno comércio e MEI de Mogi
Guaçu e Mogi Mirim, que não compram patrocínio recorrente (ver
`precificacao.md` e o perfil da região). Porta de entrada e escola de
patrocínio, não substituto do comercial.

## O produto

- **R$ 97 por semana**, à vista (Pix ou cartão), **10 vagas por semana**,
  vendidas até 4 semanas à frente, sempre a partir da próxima segunda.
- Entrega: **1 story** no Instagram do PFC + **a vitrine `/ofertas`** a semana
  inteira + **link rastreado `/o/{codigo}`** que leva ao WhatsApp do
  anunciante e conta os cliques.
- **Nunca** inclui menção do apresentador, logo no estúdio nem presença no
  episódio: isso é patrocínio. Anunciar toda semana sai R$ 388/mês, mais que o
  Apoio (R$ 297): o upsell se faz sozinho.

## O fluxo

1. `/anuncie`: escolhe a semana (vagas ao vivo), escreve a oferta, informa
   dados da nota. Instagram opcional: a logo e a cor vêm do Business Discovery.
2. A ação reserva a vaga de forma atômica (`ads_reservar_oferta`, advisory lock
   por semana) por **1 hora** e abre o **Checkout Pro**. Boleto fica de fora.
3. Pagamento → **webhook** `/api/ads/mp/webhook` e/ou **página de retorno**
   `/anuncie/retorno`. Os dois só confiam numa reconsulta do pagamento na API.
   Pix pendente segura a vaga por 24 h. Pago depois da reserva vencer é aceito
   (pode passar 1 vaga), porque recusar dinheiro já pago é pior.
4. `/admin/ofertas`: **Aprovar e gerar arte** → story 1080×1920 feito por
   código (sem IA inventando logo), dentro da zona segura do Instagram, e
   agendado no próximo horário livre da semana (seg–sáb, 12h/15h/18h).
   Recusar devolve 100% pelo Mercado Pago.
5. O cron do social (`/api/cron/social`, a cada 5 min) publica o story na hora.

## Mercado Pago

- App própria **PFCTV Ads** (4810466077758688, Checkout Pro), separada da
  "Contenta AI".
- Env: `MP_ACCESS_TOKEN` (teste em dev/preview; produção só no ambiente
  Production da Vercel), `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`.
- O webhook vai sempre para o domínio oficial. Em localhost e no preview
  protegido ele não chega, e a página de retorno confirma o pagamento.

## Pendências fora do código

- **Nota fiscal:** na fase 1, emissão manual em lote semanal; o admin mostra
  quantas pagas estão sem nota. Automatizar na fase 2.
- **Ativar a produção** da app no painel do Mercado Pago e cadastrar a URL do
  webhook + a chave secreta.
- **Faixa no GC do PFC News** e short semanal "Ofertas de Mogi": fase 2.
