# Campanha de fim de ano · Patrocinador fundador

> Vale para contratos fechados (assinados e com o 1º mês pago) **até 20/12/2026**.
> Decidida em 16/11/2026. As regras ficam em `src/lib/campanha.ts`. Quando o prazo
> passa, o site e o painel tiram a campanha sozinhos. Complementa
> `docs/estrategia-revendedores-parceiros.md`.

## 1. As três ofertas

| Para quem | O que ganha | Exemplo na cota master (R$ 997/mês) |
|---|---|---|
| **Marca que patrocina um quadro novo** | Fica como **patrocinador fundador**: o preço não sobe por 12 meses e ganha **um PFC Visita de brinde** ao completar 3 meses de contrato | R$ 997/mês até dez/2027, mais um episódio no espaço dela (vale R$ 1.350) |
| **Apresentador que traz um patrocinador** | Recebe 1 mensalidade inteira se vendeu, ou 30% se só indicou. Se o patrocínio for **para o quadro dele**, ganha **+20%** | Vendeu: **R$ 1.196** · Indicou: **R$ 359** |
| **Apresentador que patrocina com a própria empresa** | **25% off** em qualquer plano ou cota, enquanto continuar apresentando | Cota master por **R$ 748/mês** · Apoio R$ 223 · Patrocinador R$ 598 · Master R$ 1.498 |

Os parceiros que não são apresentadores (influencers) seguem a regra normal do
programa: 1 mensalidade se vendeu e 30% se indicou, sem o bônus de 20%. A
condição de fundador vale para qualquer marca, venha ela de quem vier.

**Quadros que entram como "novos":** os que têm `isNew` e uma cota ainda não
vendida em `src/lib/config.ts`. Hoje é só o **PFC Esporte Clube**. Para incluir o
quadro de tattoo e o Fora do Frame, eles precisam ser cadastrados no config com
`isNew: true` e `cota`.

### A conta fecha?

O pior caso é uma marca fundadora trazida por um apresentador que vendeu para o
próprio quadro. Em 3 meses entram R$ 2.991. Saem R$ 1.196 de comissão e o custo
de produção do PFC Visita. O contrato se paga no 3º mês e, a partir do 4º, a
mensalidade fica toda com o PFC. A comissão é paga metade no 1º pagamento e
metade no 3º, então quem cancelar antes não leva a segunda metade.

## 2. Regras que não mudam com a campanha

1. Toda indicação é **registrada antes do contato**, no painel `/revendedor`.
   A equipe responde em até 48h. Aprovada, ela fica protegida por 60 dias.
2. Contato que já está na base, ou que foi abordado nos últimos 90 dias, não
   entra. O painel avisa na hora.
3. Comissão só sobre **dinheiro que entrou**. O desconto de 25% do apresentador
   não gera comissão para ninguém.
4. Ninguém negocia preço fora da tabela e ninguém promete exclusividade de
   segmento: a cota master é fechada pela equipe.
5. "Preço travado por 12 meses" vale para quem renova sem interrupção. O
   contrato mínimo continua sendo de 3 meses.

## 3. Como operar

**Antes de começar (uma vez):**
1. Rodar `supabase/029_indicacoes_patrocinio.sql` no SQL Editor do Supabase.
2. Em `/admin/revendedores`, cadastrar cada apresentador como revendedor: marcar
   **"É apresentador de quadro"**, escolher o quadro e criar o login.
3. Mandar para cada um o acesso ao painel, junto com a mensagem da seção 4.

**No dia a dia:**
- O parceiro manda o **link de patrocínio** (`/r/{slug}?ir=plano`), que abre o
  Monte seu plano. O pedido que sair de lá entra como indicação dele.
- Ou ele registra a empresa no painel antes de procurar.
- Em `/admin/revendedores/indicacoes`: aprovar, depois marcar "Em reunião" e
  por fim "Fechada", informando a mensalidade. A comissão é calculada e
  congelada nesse momento, já com o bônus quando houver. Depois é só marcar as
  parcelas pagas quando o Pix sair.
- Se um apresentador patrocinar, registre como "Minha empresa vai patrocinar" e
  feche a proposta aplicando os 25% manualmente: o Monte seu plano mostra o
  preço de tabela.

## 4. Mensagens prontas

**Para os apresentadores (convite):**

> Fala, {nome}! Até 20/12 a gente está numa campanha para fechar os patrocínios
> de 2027 e você entra nela de dois jeitos:
> 1) Trouxe uma marca para patrocinar o PFC: você leva uma mensalidade inteira
> (R$ 997 numa cota de quadro). Se for para o {quadro}, leva +20% (R$ 1.196).
> 2) Se a sua empresa quiser patrocinar, sai com 25% off enquanto você apresentar.
> Seu painel já está no ar: {link do painel}. Lá tem o seu link de patrocínio e o
> botão para registrar as empresas antes de procurar. Bora fechar 2026 forte?

**Do apresentador para a marca:**

> Oi, {nome}! O {quadro} está abrindo as primeiras cotas de patrocínio, e quem
> fechar até 20/12 vira patrocinador fundador: R$ 997/mês travado por 12 meses
> e um episódio do PFC Visita gravado no seu espaço, de brinde. Monta o plano
> aqui que você já vê o preço: {link de patrocínio}

**Follow-up depois de 3 dias sem resposta:**

> {nome}, só lembrando que a condição de fundador vai até 20/12 e a cota master
> é uma só por quadro. Quer que eu marque 15 minutos com a equipe do PFC para te
> mostrar como a marca aparece?

## 5. Metas até 20/12

| Meta | Número |
|---|---|
| Apresentadores com painel ativo | todos os hosts dos quadros ativos |
| Indicações registradas | 15 |
| Reuniões feitas | 8 |
| Contratos fechados | 3, sendo pelo menos 1 cota fundadora do PFC Esporte Clube |
