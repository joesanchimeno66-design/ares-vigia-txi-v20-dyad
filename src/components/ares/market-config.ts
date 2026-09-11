import {
  BadgeDollarSign, BarChart3, Bitcoin, BookOpen, Bot, BrainCircuit, Building2,
  CircleDollarSign, Gem, Globe2, House, Landmark, Layers3, MessageCircle,
  Radar, ShieldCheck, Sparkles, type LucideIcon,
} from "lucide-react";

export type MarketId = "acciones" | "europa" | "cripto" | "etfs" | "fondos" | "pequenas" | "indices" | "forex" | "materias";
export type SectionId = "inicio" | MarketId | "escudo" | "telegram" | "ia" | "guia";

export type NavItem = { id: SectionId; label: string; short: string; icon: LucideIcon; description: string };

export const navItems: NavItem[] = [
  { id: "inicio", label: "Inicio", short: "Inicio", icon: House, description: "Centro de mando ARES V13" },
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
  returns: { intraday: number | null; week: number | null; month: number | null; sixMonths: number | null; year: number | null };
  ema9: number | null; ema21: number | null; rsi14: number | null; macd: number | null;
  macdSignal: number | null; macdHistogram: number | null; bollingerZ: number | null;
  volatility: number | null; trend: "alcista" | "bajista" | "lateral"; samples: number;
};

export type MarketQuote = {
  symbol: string; ticker: string; name: string; price: number; change: number;
  currency: string; exchange: string; updatedAt: string; points: { time: string; value: number }[];
  metrics: MarketMetrics;
};

export const fallbackQuotes: Record<MarketId, MarketQuote[]> = {
  acciones: [], europa: [], cripto: [], etfs: [], fondos: [], pequenas: [],
  indices: [], forex: [], materias: [],
};

export const getQuoteChange = (quote: MarketQuote, horizon: number) => {
  const returns = quote.metrics?.returns;
  return [returns?.intraday, returns?.week, returns?.month, returns?.sixMonths, returns?.year][horizon] ?? null;
};

export const getFlight = (change: number | null, quote?: MarketQuote) => {
  if (change === null) return { label: "SIN PERIODO", color: "slate", score: null };
  const metrics = quote?.metrics;
  let score = 50 + Math.max(-24, Math.min(24, change * 8));
  if (metrics?.ema9 !== null && metrics?.ema21 !== null) score += metrics.ema9 > metrics.ema21 ? 8 : -8;
  if (metrics?.rsi14 !== null) score += metrics.rsi14 >= 52 && metrics.rsi14 <= 72 ? 6 : metrics.rsi14 > 82 ? -7 : metrics.rsi14 < 35 ? -4 : 0;
  if (metrics?.macdHistogram !== null) score += metrics.macdHistogram > 0 ? 5 : -5;
  score = Math.round(Math.max(0, Math.min(100, score)));
  return score >= 75 ? { label: "DESPEGANDO", color: "emerald", score } : score >= 58 ? { label: "EN ASCENSO", color: "blue", score } : score <= 25 ? { label: "DESCENSO FUERTE", color: "rose", score } : score <= 42 ? { label: "DESCENDIENDO", color: "amber", score } : { label: "ESTABLE", color: "slate", score };
};

export const formatPrice = (quote: MarketQuote) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: quote.price < 10 ? 4 : 2, maximumFractionDigits: quote.price < 10 ? 5 : 2 }).format(quote.price);

export const utilityItems = [
  { icon: Bot, title: "Bot Vigía", text: "Avisa cuando el ARES mínimo se cumple." },
  { icon: BadgeDollarSign, title: "Stop limit educativo", text: "Aprende a definir activación y precio límite." },
];
