# Pagamentos — o que oferecer e quanto custa

Regra única, para site, proposta e conversa no WhatsApp. A fonte das taxas e
da regra no código é `src/lib/payment.ts`.

## A regra

| Preço | Como pode pagar |
|---|---|
| Plano anual | **Pix à vista: 20% off** (R$ 2.851 no Apoio) · **cartão em até 3x sem juros: 10% off** (R$ 3.208 no Apoio) |
| Visita avulsa | Pix à vista ou até 3x sem juros no cartão |
| Plano mensal e cotas de quadro | Pix ou cartão, mês a mês, **contrato mínimo de 3 meses** |
| Preço com desconto (Visita para cliente, proposta negociada) | **À vista**, Pix ou cartão. Parcelado com juros do comprador |
| Acima de 3x, em qualquer caso | Juros por conta do comprador |

Nunca escrever "equivale a R$ X/mês" sem dizer, ao lado, como o pagamento
acontece. Foi assim que um "R$ 214/mês" virou expectativa de 12x sem juros.

## Quanto custa absorver os juros

Taxas do simulador do Mercado Pago (10/2026, recebimento na hora). No
parcelado, soma a taxa por venda (3,09%) com a de parcelamento.

| Parcelas | Taxa total | Apoio anual (R$ 2.851) líquido | Visita avulsa (R$ 1.690) líquido |
|---|---|---|---|
| 1x | 4,98% | R$ 2.709 | R$ 1.606 |
| 2x | 10,00% | R$ 2.566 | R$ 1.521 |
| **3x** | **11,38%** | **R$ 2.527** | **R$ 1.498** |
| 6x | 15,37% | R$ 2.413 | R$ 1.430 |
| 12x | 22,59% | R$ 2.207 | R$ 1.308 |

**Por que o anual tem dois preços (desde 16/11/2026):** quando o 3x saía pelo
preço do Pix, o anual no cartão ficava ~29% abaixo de 12 mensalidades. Com 10%
off no cartão, o Apoio em 3x deixa R$ 2.843 líquidos — o mesmo que os R$ 2.851
do Pix. **Por que parar em 3x:** Em 12x a perda é 22,6%, e para
receber o valor cheio o anual teria que custar mais que 12 mensalidades
(R$ 3.683 contra R$ 3.564 no Apoio). Não fecha.

## Link de Pagamento

Ao criar o link no Mercado Pago, configure o parcelamento sem juros **até 3x**
(4x em diante com juros do comprador). Abra o link antes de mandar e confira as
parcelas. Exceção aberta: a Real Consultoria (10/2026) paga 12x sem juros,
decisão por caixa — o PFC recebe ~R$ 1.986 dos R$ 2.566 (44% abaixo da tabela
mensal). É anterior à regra de teto e não serve de precedente.

## Teto de desconto (16/11/2026)

- **Descontos não se somam.** Parceiro antigo, anual, campanha: vale o maior,
  não a soma.
- **O líquido nunca fica mais de 25% abaixo da tabela** (mensalidade × meses),
  contando a taxa do Mercado Pago que o PFC absorver.
- Exceções (ex.: 25% do apresentador que patrocina) ficam na campanha e não
  somam com o anual.

Regras e preços em `src/lib/planos.ts` (`REGRAS_PRECO`); a lógica de
precificação inteira em `docs/precificacao.md`.
