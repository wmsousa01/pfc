/**
 * Remove as faixas que a frequência das luzes deixa na foto (flicker com
 * obturador eletrônico). Cada linha do sensor é lida num instante diferente,
 * com a lâmpada num ponto diferente do ciclo: a linha inteira perde luz, e essa
 * perda se repete em períodos regulares. Foto feita com a câmera em pé fica com
 * as faixas em pé.
 *
 * Por isso a correção é só uma conta de exposição por linha, sem IA: nenhum
 * pixel é redesenhado e o rosto continua sendo o da foto original.
 */

export type Imagem = { data: Uint8ClampedArray; width: number; height: number };

/** Horizontal: faixas deitadas, o ganho muda de linha em linha. */
export type Direcao = "horizontal" | "vertical";
export type ModoDirecao = "auto" | Direcao;

export type Analise = {
  encontrou: boolean;
  direcao: Direcao;
  /** Quantas faixas escuras cabem na foto. */
  faixas: number;
  /** Quanto de luz a parte mais escura da faixa perdeu, em %. */
  intensidade: number;
  /** Log da luz perdida por linha, um por canal (R, G, B). Zero é a linha sem perda. */
  curvas: [Float32Array, Float32Array, Float32Array];
};

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Tabela fina: com poucos degraus, as sombras ficariam posterizadas. */
const PASSOS = 65535;
const SRGB = new Uint8ClampedArray(PASSOS + 1);
for (let i = 0; i <= PASSOS; i++) {
  const l = i / PASSOS;
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  SRGB[i] = Math.round(v * 255);
}

/** Branco estourado não tem faixa: corrigir ali desenharia a faixa ao contrário. */
const PROTECAO = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const t = Math.min(1, Math.max(0, (i - 244) / 10));
  PROTECAO[i] = 1 - t * t * (3 - 2 * t);
}

const MIN_VALIDO = 10;
const MAX_VALIDO = 245;
const CICLOS_MIN = 2.5;
const PERIODO_MIN = 10;
const MAX_FREQUENCIAS = 8;
const PASSES_REFINO = 2;
const PESO_REFINO = 0.6;
const PERDA_MAX = 1.4;
const PERDA_VISIVEL = 10;

/** Média do miolo: ignora objetos que cruzam a linha sem perder a precisão. */
function mediaCentral(v: number[]): number {
  v.sort((a, b) => a - b);
  const ini = Math.floor(v.length * 0.25);
  const fim = Math.max(ini + 1, Math.ceil(v.length * 0.75));
  let s = 0;
  for (let i = ini; i < fim; i++) s += v[i];
  return s / (fim - ini);
}

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const o = [...v].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

/** Tira a variação lenta (a luz da cena), deixando só o que oscila. */
function passaAlta(sinal: Float32Array): Float32Array {
  const n = sinal.length;
  const r = Math.max(4, Math.floor(n / 4));
  const acum = new Float64Array(n + 2 * r + 2);
  const espelho = (i: number) => {
    let k = i;
    if (k < 0) k = -k - 1;
    if (k >= n) k = 2 * n - k - 1;
    return sinal[Math.max(0, Math.min(n - 1, k))];
  };
  for (let i = -r; i < n + r; i++) acum[i + r + 1] = acum[i + r] + espelho(i);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sinal[i] - (acum[i + 2 * r + 1] - acum[i]) / (2 * r + 1);
  return out;
}

/** Frequências (em ciclos por foto) que se destacam do resto do espectro. */
function frequenciasFortes(sinal: Float32Array, razao: number): number[] {
  const n = sinal.length;
  const fMax = n / PERIODO_MIN;
  const passo = 0.25;
  const total = Math.floor((fMax - CICLOS_MIN) / passo) + 1;
  if (total < 8) return [];

  const janela = new Float32Array(n);
  for (let i = 0; i < n; i++) janela[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));

  const potencia = new Float32Array(total);
  for (let k = 0; k < total; k++) {
    const w = (2 * Math.PI * (CICLOS_MIN + k * passo)) / n;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const s = sinal[i] * janela[i];
      re += s * Math.cos(w * i);
      im += s * Math.sin(w * i);
    }
    potencia[k] = re * re + im * im;
  }

  const picos: { f: number; p: number }[] = [];
  for (let k = 1; k < total - 1; k++) {
    if (potencia[k] < potencia[k - 1] || potencia[k] < potencia[k + 1]) continue;
    const f = CICLOS_MIN + k * passo;
    const vizinhos: number[] = [];
    for (let j = 0; j < total; j++) {
      const g = CICLOS_MIN + j * passo;
      if (g >= f / 1.7 && g <= f * 1.7 && Math.abs(g - f) >= 1.5) vizinhos.push(potencia[j]);
    }
    if (vizinhos.length < 4 || potencia[k] < razao * mediana(vizinhos)) continue;
    picos.push({ f, p: potencia[k] });
  }

  picos.sort((x, y) => y.p - x.p);
  const escolhidas: number[] = [];
  for (const p of picos) {
    if (escolhidas.length >= MAX_FREQUENCIAS) break;
    if (escolhidas.every((f) => Math.abs(f - p.f) >= 1)) escolhidas.push(p.f);
  }
  return escolhidas;
}

type Candidata = Analise & { nota: number };

function vazia(direcao: Direcao): Analise {
  return {
    encontrou: false,
    direcao,
    faixas: 0,
    intensidade: 0,
    curvas: [new Float32Array(1), new Float32Array(1), new Float32Array(1)],
  };
}

const casasDoCiclo = (N: number, f: number) => Math.max(16, Math.min(64, Math.round(N / f / 2)));

/** Soma os degraus de um ciclo e devolve o formato da faixa, com média zero. */
function integrarCiclo(degraus: Float32Array): Float32Array {
  const B = degraus.length;
  let media = 0;
  for (let i = 0; i < B; i++) media += degraus[i];
  media /= B;
  const bruto = new Float32Array(B);
  let soma = 0;
  for (let i = 0; i < B; i++) {
    soma += degraus[i] - media;
    bruto[i] = soma;
  }
  const out = new Float32Array(B);
  let total = 0;
  for (let i = 0; i < B; i++) {
    out[i] = (bruto[(i + B - 1) % B] + bruto[i] + bruto[(i + 1) % B]) / 3;
    total += out[i];
  }
  total /= B;
  for (let i = 0; i < B; i++) out[i] -= total;
  return out;
}

function correlacao(a: Float32Array, b: Float32Array): number {
  let xy = 0;
  let xx = 0;
  let yy = 0;
  for (let i = 0; i < a.length; i++) {
    xy += a[i] * b[i];
    xx += a[i] * a[i];
    yy += b[i] * b[i];
  }
  return xy / (Math.sqrt(xx * yy) || 1e-12);
}

function analisarEixo(img: Imagem, direcao: Direcao, sensivel: boolean): Candidata | null {
  const { data, width, height } = img;
  const horizontal = direcao === "horizontal";
  const N = horizontal ? height : width;
  const M = horizontal ? width : height;
  const T = Math.max(24, Math.min(64, Math.floor(M / 16)));
  if (N < 120 || M < 120) return null;

  // Blocos ao longo da linha: a média tira o degrau dos 8 bits, que esconderia
  // a variação mínima de uma linha para a seguinte.
  const soma = new Float32Array(4 * T * N);
  const conta = new Uint16Array(T * N);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      if (max < MIN_VALIDO || max > MAX_VALIDO) continue;
      const n = horizontal ? y : x;
      const t = Math.min(T - 1, Math.floor(((horizontal ? x : y) * T) / M));
      const k = t * N + n;
      const lr = LIN[r];
      const lg = LIN[g];
      const lb = LIN[b];
      soma[k * 4] += lr;
      soma[k * 4 + 1] += lg;
      soma[k * 4 + 2] += lb;
      soma[k * 4 + 3] += 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      conta[k]++;
    }
  }

  // Degrau de uma linha para a seguinte em cada bloco. Comparar linhas vizinhas
  // cancela a cena; degrau grande demais é contorno de objeto e fica de fora.
  const limiar = 30 / N;
  const minimo = Math.max(2, (M / T) * 0.5);
  const degrau = new Float32Array(4 * T * N).fill(NaN);
  for (let c = 0; c < 4; c++) {
    for (let t = 0; t < T; t++) {
      for (let n = 1; n < N; n++) {
        const a = t * N + n - 1;
        const b = t * N + n;
        if (conta[a] < minimo || conta[b] < minimo) continue;
        const va = soma[a * 4 + c] / conta[a];
        const vb = soma[b * 4 + c] / conta[b];
        if (va <= 1e-5 || vb <= 1e-5) continue;
        const d = Math.log(vb / va);
        if (Math.abs(d) < limiar) degrau[b * 4 + c] = d;
      }
    }
  }

  const porLinha = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    const v: number[] = [];
    for (let t = 0; t < T; t++) {
      const x = degrau[(t * N + n) * 4 + 3];
      if (!Number.isNaN(x)) v.push(x);
    }
    if (v.length >= T / 4) porLinha[n] = mediaCentral(v);
  }

  const acumulado = new Float32Array(N);
  for (let n = 1; n < N; n++) acumulado[n] = acumulado[n - 1] + porLinha[n];
  const picos = frequenciasFortes(passaAlta(acumulado), sensivel ? 5 : 8);
  if (!picos.length) return null;

  /** Quanto o sinal se repete quando dobrado no período de `f` ciclos. */
  const energia = (f: number) => {
    const B = casasDoCiclo(N, f);
    const somaCasa = new Float32Array(B);
    const contaCasa = new Uint32Array(B);
    for (let n = 1; n < N; n++) {
      const fase = (n * f) / N;
      const k = Math.min(B - 1, Math.floor((fase - Math.floor(fase)) * B));
      somaCasa[k] += porLinha[n];
      contaCasa[k]++;
    }
    for (let k = 0; k < B; k++) if (contaCasa[k]) somaCasa[k] /= contaCasa[k];
    const ciclo = integrarCiclo(somaCasa);
    let e = 0;
    for (let k = 0; k < B; k++) e += ciclo[k] * ciclo[k];
    return e / B;
  };

  // O pico mais forte pode ser um harmônico: a faixa estreita tem vários.
  const bases = new Set<number>();
  for (const f of picos) for (const d of [1, 2, 3]) if (f / d >= CICLOS_MIN) bases.add(f / d);
  const refinadas = Array.from(bases).map((base) => {
    let melhor = base;
    let maior = -1;
    for (let f = Math.max(CICLOS_MIN, base - 0.5); f <= base + 0.5; f += 0.02) {
      const e = energia(f);
      if (e > maior) {
        maior = e;
        melhor = f;
      }
    }
    return { f: melhor, e: maior };
  });
  const topo = Math.max(...refinadas.map((r) => r.e));
  const ordem = refinadas.filter((r) => r.e >= topo * 0.85).sort((a, b) => b.f - a.f);

  /** Formato de um ciclo, medido só nos blocos e linhas que o filtro aceitar. */
  const moldar = (c: number, f: number, aceita: (t: number, n: number) => boolean) => {
    const B = casasDoCiclo(N, f);
    const casas: number[][] = Array.from({ length: B }, () => []);
    for (let t = 0; t < T; t++) {
      for (let n = 1; n < N; n++) {
        if (!aceita(t, n)) continue;
        const x = degrau[(t * N + n) * 4 + c];
        if (Number.isNaN(x)) continue;
        const fase = (n * f) / N;
        casas[Math.min(B - 1, Math.floor((fase - Math.floor(fase)) * B))].push(x);
      }
    }
    return integrarCiclo(Float32Array.from(casas, (v) => (v.length ? mediaCentral(v) : 0)));
  };

  // A lâmpada pisca igual na foto inteira: as metades têm de mostrar a mesma
  // faixa. Dobra de cortina ou persiana só existe em parte da foto.
  const minimoCorr = sensivel ? 0.45 : 0.65;
  for (const { f } of ordem.slice(0, 3)) {
    const lados = correlacao(moldar(3, f, (t) => t < T / 2), moldar(3, f, (t) => t >= T / 2));
    const metades = correlacao(moldar(3, f, (_, n) => n < N / 2), moldar(3, f, (_, n) => n >= N / 2));
    const acordo = Math.min(lados, metades);
    if (acordo < minimoCorr) continue;

    const ciclos = [0, 1, 2, 3].map((c) => moldar(c, f, () => true));
    const cicloY = ciclos[3];
    const altura = Math.max(...Array.from(cicloY)) - Math.min(...Array.from(cicloY));
    if (altura < (sensivel ? 0.015 : 0.03) || altura > (sensivel ? 1.4 : 1)) continue;

    const curva = (ciclo: Float32Array) => {
      const B = ciclo.length;
      const pico = Math.max(...Array.from(ciclo));
      const out = new Float32Array(N);
      for (let n = 0; n < N; n++) {
        const fase = (n * f) / N;
        // A soma dos degraus de uma casa vale no fim dela.
        const p = (fase - Math.floor(fase)) * B - 1 + B;
        const a = Math.floor(p);
        const u = p - a;
        out[n] = ciclo[a % B] * (1 - u) + ciclo[(a + 1) % B] * u - pico;
      }
      return out;
    };

    return {
      encontrou: true,
      direcao,
      faixas: Math.round(f),
      intensidade: (1 - Math.exp(-altura)) * 100,
      curvas: [curva(ciclos[0]), curva(ciclos[1]), curva(ciclos[2])],
      nota: altura * acordo,
    };
  }
  return null;
}

/** Analisa nos dois sentidos; com direção escolhida à mão, aceita faixa mais fraca. */
export function analisarFaixas(img: Imagem, modo: ModoDirecao = "auto"): Analise {
  if (modo !== "auto") {
    const a = analisarEixo(img, modo, true);
    return a ? refinar(img, a) : vazia(modo);
  }
  const h = analisarEixo(img, "horizontal", false);
  const v = analisarEixo(img, "vertical", false);
  const melhor = h && v ? (h.nota >= v.nota ? h : v) : h ?? v;
  if (melhor) return refinar(img, melhor);

  // O sensor lê no lado curto da câmera: foto em pé tem faixa em pé. Nessa
  // direção dá para aceitar um sinal mais fraco, desde que a perda seja visível.
  const provavel: Direcao = img.height > img.width ? "vertical" : "horizontal";
  const fraca = analisarEixo(img, provavel, true);
  if (fraca) {
    const a = refinar(img, fraca);
    if (a.intensidade >= PERDA_VISIVEL) return a;
  }
  return vazia(provavel);
}

/**
 * Mede de novo depois de corrigir e soma parte do que sobrou. A foto já tratada
 * tem curva de contraste, então a primeira medida fica abaixo da perda real.
 */
function refinar(img: Imagem, inicial: Analise): Analise {
  // Mesma curva nos três canais: curvas separadas deixavam manchas de cor na pele.
  const neutra = (c: Analise["curvas"]) => c[0].map((v, n) => 0.2126 * v + 0.7152 * c[1][n] + 0.0722 * c[2][n]);
  let curva = neutra(inicial.curvas);
  for (let passe = 0; passe < PASSES_REFINO; passe++) {
    const copia: Imagem = { ...img, data: new Uint8ClampedArray(img.data) };
    removerFaixas(copia, { ...inicial, curvas: [curva, curva, curva] }, 1);
    const resto = analisarEixo(copia, inicial.direcao, true);
    if (!resto || resto.intensidade < 2.5) break;
    const extra = neutra(resto.curvas);
    // Só parte do resto entra: somar tudo passava do ponto e criava faixas claras.
    const soma = curva.map((v, n) => v + extra[n] * PESO_REFINO);
    const pico = Math.max(...Array.from(soma));
    curva = soma.map((v) => Math.max(-PERDA_MAX, v - pico));
  }

  const fundo = Math.min(...Array.from(curva));
  let faixas = 0;
  let dentro = false;
  for (let n = 0; n < curva.length; n++) {
    const escuro = curva[n] < fundo * 0.5;
    if (escuro && !dentro) faixas++;
    dentro = escuro;
  }
  return { ...inicial, curvas: [curva, curva, curva], faixas, intensidade: (1 - Math.exp(fundo)) * 100 };
}

function reamostrar(curva: Float32Array, n: number): Float32Array {
  const out = new Float32Array(n);
  const m = curva.length;
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, Math.min(m - 1, ((i + 0.5) / n) * m - 0.5));
    const a = Math.floor(p);
    const b = Math.min(m - 1, a + 1);
    out[i] = curva[a] + (curva[b] - curva[a]) * (p - a);
  }
  return out;
}

/** Devolve às linhas escuras a luz perdida, em qualquer resolução. `forca` 1 é a medida exata. */
export function removerFaixas(img: Imagem, analise: Analise, forca: number): void {
  if (!analise.encontrou || forca <= 0) return;
  const { data, width, height } = img;
  const horizontal = analise.direcao === "horizontal";
  const N = horizontal ? height : width;
  const ganhos = reamostrar(analise.curvas[1], N).map((v) => Math.exp(-forca * v) - 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const k = PROTECAO[Math.max(r, g, b)];
      if (k === 0) continue;
      const ganho = 1 + k * ganhos[horizontal ? y : x];
      data[i] = SRGB[Math.min(PASSOS, (LIN[r] * ganho * PASSOS + 0.5) | 0)];
      data[i + 1] = SRGB[Math.min(PASSOS, (LIN[g] * ganho * PASSOS + 0.5) | 0)];
      data[i + 2] = SRGB[Math.min(PASSOS, (LIN[b] * ganho * PASSOS + 0.5) | 0)];
    }
  }
}
