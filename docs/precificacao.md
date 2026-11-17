# Precificação do PFC: benchmark, fórmula e regras

Benchmark de 16/11/2026. Os preços vivem em `src/lib/planos.ts` (planos e
`REGRAS_PRECO`) e `src/lib/config.ts` (`quadroSponsorship`). Pagamento e taxas em
`docs/pagamentos.md`.

## 1. O que o mercado pratica

| Referência | Modelo | Faixa |
|---|---|---|
| Podcast EUA, anúncio lido pelo host (mid-roll) | CPM | US$ 25–40, até 50 em negócios/B2B |
| Podcast EUA, pre-roll / rede | CPM | US$ 15–30; post-roll US$ 10–20 |
| Podcast BR de nicho B2B (Leadcultura) | Cota mensal fixa | Ouro R$ 600, Diamante R$ 1.200, mínimo 6 meses |
| YouTube, micro-criador | Cachê por vídeo (CPM de conferência) | US$ 15–50 CPM |
| Meta Ads BR 2026, Reels/Stories | CPM pago | R$ 8–20 (Feed R$ 15–35), +12% de tributo desde jan/26 |
| Estúdio de videocast SP/ES | Hora | R$ 200–450/h, edição à parte |

Leitura: fora do país o preço nasce do CPM. Na mídia local brasileira ele nasce
de **cota mensal fixa com prazo mínimo**, e o CPM serve só de conferência. Não
há tabela pública de cota de podcast do interior. Nova Onda FM, @mogidica e
MIDTV seguem pendentes (ver `benchmark-podcasts-regiao.md` §5).

Fontes: castos.com/podcast-advertising-rates · acast.com (how much does podcast
advertising cost) · adresultsmedia.com · advertising.libsyn.com ·
mkt.leadcultura.com.br/patrocinio-podcast · creatorsjet.com ·
influencermarketinghub.com · trafius.com.br · dasckup.com.

## 2. A fórmula por trás da tabela

**Preço ≈ R$ 60 por episódio × episódios no mês × fator de exclusividade**

| Produto | Conta | Preço |
|---|---|---|
| Patrocinador (canal todo, logo entre vários) | 13 × 60 × 1 | R$ 797 |
| Cota master de quadro ("apresentado por") | 4 × 60 × 4 | R$ 997 |
| Master (canal todo, exclusividade de segmento) | 13 × 60 × 2,5 | R$ 1.997 |
| Cota de apoio de quadro | 4 × 60 + story por episódio | R$ 397 |
| Apoio de uma modalidade | ~2 × 60 × 2 | R$ 247 |
| Apoio (canal, inserções pontuais) | — | R$ 297 |

A cota de um quadro custa mais que o Patrocinador do canal todo porque dar o
nome do quadro à marca vale mais por episódio do que um logo dividido. Esse é o
argumento de venda para quem estranhar.

**Conferência por CPM:** com o canal fazendo de 25 a 45 mil views por mês, o
Patrocinador e o Master ficam em ~R$ 40–60 de CPM efetivo, acima da Meta crua e
abaixo do anúncio lido por host nos EUA. A cota de quadro é o ponto fraco: pode
passar de R$ 100–200 de CPM. **Pendente:** medir views por quadro (90 dias) e
decidir se ela precisa de compensação em shorts quando a meta não for atingida.

## 3. Regras (aprovadas em 16/11/2026)

1. **Contrato mínimo de 3 meses** em tudo que é recorrente: planos e cotas.
2. **Anual:** 20% off no Pix à vista, 10% off no cartão em até 3x. O líquido
   para o PFC é o mesmo nos dois.
3. **Descontos não se somam.** O líquido nunca fica mais de 25% abaixo da tabela
   mensal × meses. Parceiro antigo substitui o desconto do anual.
4. **Visita a preço de cliente** (R$ 1.350) só com plano ou cota ativa, que pela
   regra 1 já tem 3 meses ou mais. Isso fecha a brecha de "1 mês de Apoio +
   Visita barata".
5. **Cotas de apoio com preço:** R$ 397 por quadro e R$ 247 por modalidade.
6. **Comissão "vendeu"** = 30% do contrato mínimo (0,9 mensalidade). Anual
   continua 1,5×. Quem fechar **dentro da campanha** (até 20/12/2026) mantém a
   mensalidade inteira prometida aos parceiros.
7. **Exclusividade:** o segmento de um cliente Master fica bloqueado em todas as
   cotas de quadro enquanto o contrato durar.
8. **Brinde do fundador:** a Visita é gravada no 4º mês, depois da 4ª
   mensalidade paga, para não virar 36% de desconto para quem cancela no fim do
   mínimo.

### Pontos conhecidos que ficaram de fora

- O bônus de +20% do apresentador na campanha leva a comissão a 36% do
  contrato mínimo (1,2 mensalidade sobre 3), acima do teto de 30%. Mantido
  por ser promessa da campanha que está no ar. Some sozinho em 20/12.
- **Falta o custo por episódio** (equipe, estúdio, edição) para calcular o piso
  de margem. Hoje a tabela está conferida em coerência e mercado, não em margem.
