import {
  BadgeDollarSign, BarChart3, Bitcoin, BookOpen, Bot, BrainCircuit, BriefcaseBusiness, Building2,
  CircleDollarSign, Gem, Globe2, GraduationCap, House, Landmark, Layers3, MessageCircle,
  Radar, ShieldCheck, Sparkles, type LucideIcon,
} from "lucide-react";

export type MarketId = "acciones" | "europa" | "cripto" | "etfs" | "fondos" | "pequenas" | "indices" | "forex" | "materias";
export type SectionId = "inicio" | MarketId | "portfolio" | "bots-ares" | "bot-academy" | "escudo" | "telegram" | "ia" | "guia";

export type NavItem = { id: SectionId; label: string; short: string; icon: LucideIcon; description: string };

export const navItems: NavItem[] = [
  { id: "inicio", label: "Inicio", short: "Inicio", icon: House, description: "Centro de mando ARES V13" },
  { id: "portfolio", label: "Portfolio", short: "Portfolio", icon: BriefcaseBusiness, description: "Seguimiento y análisis de cartera" },
  { id: "bots-ares", label: "BOTS ARES", short: "Bots", icon: Bot, description: "Configura y vigila bots por confluencia" },
  { id: "bot-academy", label: "Bot Academy", short: "Academy", icon: GraduationCap, description: "Aprende, configura y simula bots" },
  { id: "acciones", label: "Acciones", short: "Acciones", icon: BarChart3, description: "Radar USA · cinco horizontes" },
  { id: "europa", label: "Europa", short: "Europa", icon: Globe2, description: "Cotización nativa europea" },
  { id: "cripto", label: "Criptomonedas", short: "Cripto", icon: Bitcoin, description: "Mercado digital 24/7" },
  { id: "etfs", label: "ETFs", short: "ETFs", icon: Layers3, description: "Fondos cotizados globales" },
  { id: "fondos", label: "Fondos", short: "Fondos", icon: Landmark, description: "Fondos abiertos de referencia" },
  { id: "pequenas", label: "Pequeñas", short: "Small caps", icon: Sparkles, description: "Impulso intradía y swing" },
  { id: "indices", label: "Índices", short: "Índices", icon: Building2, description: "Contexto mundial" },
  { id: "forex", label: "Forex", short: "Forex", icon: CircleDollarSign, description: "Pares principales 24/5" },
  { id: "materias", label: "Materias primas", short: "Materias", icon: Gem, description: "Metales, energía y agrícolas" },
  { id: "escudo", label: "Eunomia Escudo", short: "Escudo", icon: ShieldCheck, description: "Control antifraude orientativo" },
  { id: "telegram", label: "Telegram", short: "Telegram", icon: MessageCircle, description: "Canal de alertas ARES" },
  { id: "ia", label: "ARES IA", short: "ARES IA", icon: BrainCircuit, description: "Análisis local del radar" },
  { id: "guia", label: "Guía", short: "Guía", icon: BookOpen, description: "Aprende a usar la plataforma" },
];

export const marketIds = new Set<SectionId>(["acciones", "europa", "cripto", "etfs", "fondos", "pequenas", "indices", "forex", "materias"]);

export const moduleCards = [
  { id: "acciones" as SectionId, icon: BarChart3, title: "Radar de mercados", text: "Acciones, Europa, ETFs, fondos y pequeñas compañías.", tone: "blue" },
  { id: "cripto" as SectionId, icon: Bitcoin, title: "Cripto 24/7", text: "Pulso, variación y lanzadera técnica por activo.", tone: "violet" },
  { id: "indices" as SectionId, icon: Radar, title: "Contexto global", text: "Índices, divisas y materias en una sola lectura.", tone: "emerald" },
  { id: "escudo" as SectionId, icon: ShieldCheck, title: "Eunomia Escudo", text: "Organiza indicios y facilita la verificación oficial.", tone: "amber" },
  { id: "ia" as SectionId, icon: BrainCircuit, title: "ARES IA", text: "Resumen colaborativo basado en el radar cargado.", tone: "cyan" },
  { id: "telegram" as SectionId, icon: MessageCircle, title: "Alertas", text: "Centro de avisos, Bot Vigía y canal Telegram.", tone: "rose" },
];

export type MarketMetrics = {
  returns: { intraday: number | null; week: number | null; tenDays: number | null; twentyDays: number | null; thirtyDays: number | null; month: number | null; threeMonths: number | null; sixMonths: number | null; year: number | null };
  ema9: number | null; ema21: number | null; emaSlope: number | null; rsi14: number | null; macd: number | null;
  macdSignal: number | null; macdHistogram: number | null; bollingerZ: number | null; bollingerExpansion: number | null;
  volumeRatio: number | null; volumeTrend: number | null; support: number | null; resistance: number | null;
  breakoutPct: number | null; failedBreakout: boolean; volatility: number | null;
  trend: "alcista" | "bajista" | "lateral" | null; samples: number;
};

export type MarketQuote = {
  symbol: string; ticker: string; name: string; price: number; previousClose: number; open: number; high: number; low: number; volume: number | null; change: number;
  currency: string; exchange: string; updatedAt: string; chartSymbol: string;
  priceProvider?: string; changeProvider?: string; historyProvider?: string;
  points: { time: string; value: number; open: number; high: number; low: number; volume: number | null }[]; metrics: MarketMetrics;
};

export type MarketCandle = {
  time: string; open: number; high: number; low: number; close: number; volume: number | null;
};

export const fallbackQuotes: Record<MarketId, MarketQuote[]> = {
  acciones: [], europa: [], cripto: [], etfs: [], fondos: [], pequenas: [],
  indices: [], forex: [], materias: [],
};

const standardHorizonLabels = ["INTRADÍA", "5 DÍAS", "3 MESES", "6 MESES", "1 AÑO"];
const cryptoHorizonLabels = ["24 HORAS", "10 DÍAS", "20 DÍAS", "30 DÍAS", "1 AÑO"];

export const getHorizonLabels = (market: MarketId) => market === "cripto" ? cryptoHorizonLabels : standardHorizonLabels;

export const getQuoteChange = (quote: MarketQuote, horizon: number, market?: MarketId) => {
  const returns = quote.metrics?.returns;
  const periods = market === "cripto"
    ? [returns?.intraday, returns?.tenDays, returns?.twentyDays, returns?.thirtyDays, returns?.year]
    : [returns?.intraday, returns?.week, returns?.threeMonths, returns?.sixMonths, returns?.year];
  return periods[horizon] ?? null;
};

export type FlightAnalysis = {
  label: "SIN SEÑAL" | "VIGILAR" | "PREPARANDO" | "LANZADERA ACTIVA" | "LANZADERA FUERTE" | "SIN DATOS";
  color: "slate" | "amber" | "blue" | "emerald" | "violet";
  score: number | null;
  reasons: string[];
  invalidations: string[];
  categories: { name: string; score: number; max: number }[];
};

export const getFlight = (change: number | null, quote?: MarketQuote, market?: MarketId): FlightAnalysis => {
  const metrics = quote?.metrics;
  if (!quote || !metrics || change === null || metrics.samples < 9) return { label: "SIN DATOS", color: "slate", score: null, reasons: ["Serie histórica insuficiente para aplicar ARES V20."], invalidations: ["La lectura no es válida sin suficientes observaciones reales."], categories: [] };
  const reasons: string[] = [];
  const invalidations: string[] = [];
  const categories: FlightAnalysis["categories"] = [];
  const add = (name: string, score: number, max: number) => categories.push({ name, score: Math.max(0, Math.min(max, score)), max });

  let trend = 0;
  if (metrics.ema9 != null && metrics.ema21 != null && metrics.ema9 > metrics.ema21) { trend += 8; reasons.push("EMA 9 por encima de EMA 21."); } else invalidations.push("Cruce bajista de EMA 9 bajo EMA 21.");
  if (metrics.ema9 != null && metrics.ema21 != null && quote.price > metrics.ema9 && quote.price > metrics.ema21) { trend += 6; reasons.push("Precio por encima de ambas medias."); } else invalidations.push("Cierre por debajo de EMA 9 o EMA 21.");
  if (metrics.emaSlope != null && metrics.emaSlope > 0) { trend += 5; reasons.push("Pendiente de EMA 9 positiva."); } else invalidations.push("La pendiente de corto plazo deja de ser positiva.");
  const periodAnchors = market === "cripto" ? [metrics.returns.tenDays, metrics.returns.thirtyDays] : [metrics.returns.week, metrics.returns.threeMonths];
  const trendHorizons = [change, ...periodAnchors].filter((value): value is number => value != null);
  const positiveTrendHorizons = trendHorizons.filter(value => value > 0).length;
  if (positiveTrendHorizons >= 2) { trend += 6; reasons.push("El horizonte seleccionado confirma la tendencia real."); } else if (positiveTrendHorizons === 1) trend += 3;
  add("Tendencia", trend, 25);

  let volume = 0;
  if (metrics.volumeRatio != null && metrics.volumeRatio >= 1.2) { volume += 8; reasons.push(`Volumen ${metrics.volumeRatio.toFixed(1)}× sobre su media.`); } else invalidations.push("La ruptura pierde validez si el volumen no supera su media.");
  if (metrics.volumeTrend != null && metrics.volumeTrend > 0) { volume += 5; reasons.push("Entrada de volumen creciente."); }
  if ((metrics.breakoutPct ?? -1) > 0 && (metrics.volumeRatio ?? 0) >= 1.2) { volume += 7; reasons.push("Ruptura confirmada por volumen."); }
  add("Volumen", volume, 20);

  let momentum = 0;
  if (metrics.rsi14 != null && metrics.rsi14 >= 52 && metrics.rsi14 <= 70) { momentum += 8; reasons.push(`RSI ${metrics.rsi14.toFixed(1)} en zona de impulso saludable.`); }
  if (metrics.rsi14 != null && metrics.rsi14 < 78) momentum += 3; else invalidations.push("RSI en sobrecompra extrema (78 o superior).");
  if (metrics.macdHistogram != null && metrics.macdHistogram > 0) { momentum += 4; reasons.push("Momentum MACD positivo."); } else invalidations.push("El momentum se invalida si MACD pierde terreno positivo.");
  add("Momentum", momentum, 15);

  let bollinger = 0;
  if (metrics.bollingerExpansion != null && metrics.bollingerExpansion > 0) { bollinger += 5; reasons.push("Bandas de Bollinger en expansión."); }
  if (metrics.bollingerZ != null && metrics.bollingerZ >= 0.5 && (metrics.macdHistogram ?? 0) > 0) { bollinger += 5; reasons.push("Precio sobre banda media con confirmación de momentum."); }
  add("Bollinger", bollinger, 10);

  let levels = 0;
  if ((metrics.breakoutPct ?? -1) > 0 && !metrics.failedBreakout) { levels += 7; reasons.push(`Resistencia superada por ${metrics.breakoutPct!.toFixed(2)}%.`); }
  if (metrics.support != null && quote.price >= metrics.support && (quote.price - metrics.support) / quote.price <= 0.08) { levels += 4; reasons.push(`Soporte cercano definido en ${metrics.support.toFixed(2)}.`); }
  if (!metrics.failedBreakout && (metrics.breakoutPct ?? -10) >= -1) levels += 4;
  if (metrics.failedBreakout) invalidations.push("Falsa ruptura detectada: el precio volvió bajo la resistencia previa.");
  else if (metrics.resistance != null) invalidations.push(`La señal pierde fuerza si no consolida sobre la resistencia ${metrics.resistance.toFixed(2)}.`);
  if (metrics.support != null) invalidations.push(`Invalidación técnica si pierde el soporte ${metrics.support.toFixed(2)}.`);
  add("Soporte / resistencia", levels, 15);

  let volatility = 0;
  if (metrics.volatility != null && metrics.volatility >= 10 && metrics.volatility <= 65) { volatility = 5; reasons.push("Volatilidad suficiente y controlada."); }
  else if (metrics.volatility != null && metrics.volatility > 90) invalidations.push("Volatilidad errática superior al 90% anualizado.");
  add("Volatilidad", volatility, 5);

  let multi = 0;
  const core = [change, ...periodAnchors];
  const alignmentLabel = market === "cripto" ? "10D y 30D" : "5D y 3M";
  if (core.every(value => value != null && value > 0)) { multi += 7; reasons.push(`El periodo seleccionado, ${alignmentLabel} están alineados al alza.`); }
  else invalidations.push(`El periodo seleccionado debe confirmar la alineación positiva de ${alignmentLabel}.`);
  const longTerm = [metrics.returns.sixMonths, metrics.returns.year].filter((value): value is number => value != null);
  if (longTerm.length && longTerm.every(value => value > 0)) { multi += 3; reasons.push("6M y 1Y acompañan la señal."); }
  add("Multihorizonte", multi, 10);

  const score = Math.round(categories.reduce((total, category) => total + category.score, 0));
  if (!metrics.volumeRatio) invalidations.push("No hay volumen comparable: el bloque Volumen no suma puntos.");
  if (score >= 85) return { label: "LANZADERA FUERTE", color: "violet", score, reasons, invalidations, categories };
  if (score >= 75) return { label: "LANZADERA ACTIVA", color: "emerald", score, reasons, invalidations, categories };
  if (score >= 65) return { label: "PREPARANDO", color: "blue", score, reasons, invalidations, categories };
  if (score >= 50) return { label: "VIGILAR", color: "amber", score, reasons, invalidations, categories };
  return { label: "SIN SEÑAL", color: "slate", score, reasons, invalidations, categories };
};

export const formatPrice = (quote: MarketQuote) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: quote.price < 10 ? 4 : 2, maximumFractionDigits: quote.price < 10 ? 5 : 2 }).format(quote.price);

export const utilityItems = [
  { icon: Bot, title: "Bot Vigía", text: "Avisa cuando el ARES mínimo se cumple." },
  { icon: BadgeDollarSign, title: "Stop limit educativo", text: "Aprende a definir activación y precio límite." },
];
