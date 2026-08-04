# Benchmark — Fora da Caixa vs. mídia local de Mogi Guaçu e região

Levantamento de 2026-08-04, com **números reais de YouTube**. Complementa
`estrategia-social-patrocinadores.md` (posicionamento) e
`estrategia-revendedores-parceiros.md` (economia). Alimenta
`src/lib/benchmark.ts` e a página `/revendedor/comparativo`.

---

## 0. Método

Os dados de YouTube saem do bloco `aboutChannelViewModel` da página `/about`
de cada canal — o mesmo que a aba "Sobre" mostra ao público. Cada linha foi
conferida contra o `channelId` do canal.

**Armadilha encontrada, registrada para quem repetir a coleta:** a página
`/about` também carrega cards de canais relacionados, e cada card traz o próprio
`subscriberCountText`. Uma regex solta no HTML pega o card errado — no
`@PapoForadaCaixa` ela devolvia "1,68 mil" (canal vizinho) em vez de **1,53 mil**
(o correto). Ancore sempre no `aboutChannelViewModel`, que é o único bloco que
carrega `channelId` junto e permite conferir de quem é o número.

O que **não** é conferível e continua como lacuna: audiência de rádio (não há
auditoria de terceiro na região), visualizações por post no Instagram (a
plataforma não expõe), e tabela de preço de qualquer veículo.

---

## 1. Os números (coletados em 04/08/2026)

Ordenado por **visualizações por mês** — total do canal dividido pelos meses de
existência. Sem normalizar por idade, um canal de 2014 parece maior só por ser
velho.

| Canal | Cidade | Inscritos | Views totais | Vídeos | No ar | **Views/mês** | Views/vídeo |
|---|---|---:|---:|---:|---:|---:|---:|
| **Fora da Caixa** | Mogi Guaçu | 1,53 mil | **825.187** | 2.650 | 18 m | **45.844** | 311 |
| Itapira News TV | Itapira | 8,99 mil | 2.649.221 | 1.170 | 142 m | 18.657 | **2.264** |
| Nova Onda FM | Mogi Guaçu | **1,66 mil** | 208.045 | 900 | 75 m | 2.774 | 231 |
| Jovem Pan São João | SJBV | 3,5 mil | 350.462 | 1.412 | 132 m | 2.655 | 248 |
| Mogi Guaçu do Futuro | Mogi Guaçu | 411 | 64.776 | 178 | 30 m | 2.159 | 364 |
| Desnichados Podcast | Mogi Guaçu | 325 | 52.676 | 297 | 31 m | 1.699 | 177 |
| Arraste Uma Cadeira | SJBV | 482 | 24.504 | 178 | 26 m | 943 | 138 |
| Guaçu Agora | Mogi Guaçu | 257 | 72.081 | 60 | 77 m | 936 | 1.201 |
| MIDTV Mogi Guaçu | Mogi Guaçu | 676 | 39.688 | 1.052 | 132 m | 301 | 38 |

Canais menores conferidos e descartados por irrelevância comercial: Café e
Prosa Pod (58 inscritos), Podetec (41), Geração Taberna (34), PodCast Mogiano
(6), Mogi Guaçu PODCAST (3).

Instagram (eixo separado, não somar com o de cima): **@mogidica 34 mil
seguidores**, **@mogiguacu.noticias 18 mil**.

---

## 2. O que os números dizem

### 2.1 O PFC é, com folga, o maior produtor de audiência em vídeo da cidade

45.844 views/mês contra 2.774 da Nova Onda — **16,5×**. Contra o Desnichados, o
outro podcast de Guaçu com constância real, **27×**. Em volume absoluto, 825 mil
views em 18 meses contra 208 mil da Nova Onda em 6 anos.

Isso corrige a leitura da primeira versão deste documento, que dizia não haver
concorrente de podcast. Há: o **Desnichados** (325 inscritos, 297 episódios
desde jan/2024) é um projeto real e constante. Ele só é muito menor.

### 2.2 O melhor argumento de venda do levantamento é contra nós

**A Nova Onda FM tem mais inscritos que o Fora da Caixa** — 1,66 mil contra
1,53 mil — **e um quarto das visualizações**.

Isso é ouro. É a prova concreta, com um veículo que o comerciante respeita, de
que inscrito não mede entrega. E funciona justamente porque o número parece
pesar contra nós primeiro: quem apresenta um dado desfavorável a si mesmo
compra credibilidade para o resto da conversa. Está na página do revendedor como
bloco próprio.

Consequência prática: a regra do playbook de "nunca liderar por inscritos" ganha
uma demonstração, em vez de ser só uma esquiva.

### 2.3 Onde nós perdemos, e está na página

**311 views por vídeo.** O Guaçu Agora faz 1.201 com 60 vídeos publicados; o
Itapira News faz 2.264. Nosso modelo é volume — 2.650 peças — não peça matadora.

Isso precisa estar visível no material. Um comparativo em que só ganhamos não
sobrevive ao primeiro cliente que confere, e todos esses números são conferíveis
em dois cliques.

### 2.4 Existe TV local, e ela não estava no radar

**MIDTV Mogi Guaçu** (`@midtv35.1`), no ar desde 2015, 676 inscritos. No YouTube
é pequena (301 views/mês), mas é televisão — carrega peso institucional que
nenhum canal digital tem, especialmente com cliente mais velho e com o poder
público. Vale mapear a tabela comercial dela.

### 2.5 O teto da região fica em Itapira

**Itapira News TV**: 2,65 milhões de views, 8,99 mil inscritos, melhor média por
vídeo do levantamento. Não disputa a mesma verba, mas prova que audiência local
em escala existe no interior — e é a referência honesta a citar antes que o
cliente cite.

---

## 3. A concorrência que não é vídeo

### Rádio — o incumbente

Nova Onda FM 99,3: 30+ anos, 40+ cidades, mídia kit declarando "3 milhões de
pessoas" e "8 mil ouvintes por minuto". São números de **cobertura de sinal**,
não de audiência medida, e não há auditoria de terceiro. Mas o comerciante
acredita, porque 30 anos de marca compram credibilidade que planilha não derruba.

**Mantida a decisão de não atacar rádio.** A frase de reunião continua sendo
*"rádio alcança, a gente comprova"* — e agora o gráfico de YouTube tem uma
ressalva escrita dizendo que a audiência de FM é real e não aparece ali. Sem
essa ressalva o material seria enganoso, e enganoso quebra na primeira pergunta.

### Instagram — @mogidica segue sendo o mais relevante

34 mil seguidores, formato mais próximo do nosso (pessoas, não marca), vende
para o mesmo comerciante. Não tem QR, landing por anunciante nem relatório.

Segue valendo: **alvo prioritário do programa de revendedores, não da
concorrência.** Um perfil que já monetiza publi entende "pago em mídia, você
vira convidado" em cinco minutos.

### Estúdios locais

Sede de Mais e On Estúdio alugam hora de gravação em Guaçu. A barreira de
entrada da categoria caiu — a defesa não é o podcast, é a **plataforma** (QR,
landing, tracking, painel). Prioridade nos P0.

---

## 4. Correções que este levantamento forçou

- `channelStats` em `src/lib/config.ts` estava defasado **para menos**:
  inscritos 1.370 → **1,53 mil**, vídeos 2.340 → **2.650**, views totais
  "+799 mil" → **825.187**. Corrigido.
- `views12m` (806 mil) e `watchHoursYear` (4.474) **não têm equivalente
  público** — só saem do YouTube Studio. Ficaram como estavam; para atualizar,
  é preciso entrar no Studio.

---

## 5. O que ainda falta coletar (não é conferível na web)

- [ ] **Tabela da Nova Onda FM** — `novaondafm.com.br/comercial`. É a âncora de
      preço da cidade; sem ela você negocia no escuro.
- [ ] **Tabela do @mogidica** — define seu teto no digital local.
- [ ] **Tabela da MIDTV** — o preço de "sair na TV" na cidade.
- [ ] **Views medianas dos nossos últimos 10 episódios cheios** (não cortes).
      "825 mil" é agregado; o número por episódio é o que vende cota.
- [ ] Refazer a coleta de YouTube a cada trimestre — o script está em
      `docs/` na seção abaixo.

---

## 6. Como refazer a coleta

Os números vivem em `src/lib/benchmark.ts`, com `coletadoEm` fixando o mês de
referência (as médias por mês dividem até essa data, nunca até "hoje" — senão
cairiam sozinhas com o tempo).

Para atualizar: abrir a aba "Sobre" de cada canal da tabela §1, anotar
inscritos / visualizações / vídeos, e atualizar o arquivo junto com
`coletadoEm` e `atualizadoEm`. Leva cerca de 15 minutos para os 9 canais.

Canais da lista, com handle:
`@PapoForadaCaixa` · `@NovaOndaFM993` · `@midtv35.1` · `@guacuagora139` ·
`@mogiguacudofuturo` · `@desnichados` · `@ItapiraNewsTV` ·
`@jovempansaojoaooficial` · `@ArrasteUmaCadeira`

---

## Fontes

Páginas públicas dos canais no YouTube (aba "Sobre"), conferidas em 04/08/2026.
Instagram: perfis públicos [@mogidica](https://www.instagram.com/mogidica/) e
[@mogiguacu.noticias](https://www.instagram.com/mogiguacu.noticias/).
Rádio: [material comercial da Nova Onda FM](https://novaondafm.com.br/comercial/).
Podcasts sem canal de YouTube relevante:
[A Mogi Mirim que queremos](https://podcasts.apple.com/us/podcast/a-mogi-mirim-que-queremos/id1537265163) (jornal A Comarca) e
[Você Pod22](https://www.apm.org.br/podcast-voce-pod22-de-mogi-mirim-chega-ao-11-episodio/) (APM Mogi Mirim) — ambos institucionais, sem cota comercial aberta.
