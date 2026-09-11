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

export type MarketQuote = {
  symbol: string; ticker: string; name: string; price: number; change: number;
  currency: string; exchange: string; updatedAt: string; points: { time: string; value: number }[];
};

const fallbackRows: Record<MarketId, (string | number)[][]> = {
  acciones: [["AAPL","Apple",227.16,1.42],["NVDA","NVIDIA",138.85,2.76],["MSFT","Microsoft",418.79,-0.34],["AMZN","Amazon",214.10,.91]],
  europa: [["SAN","Banco Santander",4.72,.84],["IBE","Iberdrola",13.62,.36],["ITX","Inditex",49.18,-.22],["SAP","SAP",238.4,1.08]],
  cripto: [["BTC","Bitcoin",96472,3.18],["ETH","Ethereum",3412,1.72],["SOL","Solana",189.28,-1.04],["XRP","XRP",2.18,.62]],
  etfs: [["SPY","SPDR S&P 500 ETF",592.19,.68],["QQQ","Invesco QQQ",512.44,1.21],["VTI","Vanguard Total Market",298.72,.49],["IWM","iShares Russell 2000",221.3,-.28]],
  fondos: [["VFIAX","Vanguard 500 Index",546.21,.61],["VTSAX","Vanguard Total Market",142.37,.44],["FXAIX","Fidelity 500 Index",207.82,.63],["SWPPX","Schwab S&P 500",91.52,.59]],
  pequenas: [["SOUN","SoundHound AI",12.84,4.22],["BBAI","BigBear.ai",7.18,2.76],["LUNR","Intuitive Machines",13.42,-1.18],["RKLB","Rocket Lab",27.62,3.11]],
  indices: [["S&P 500","S&P 500",5930.85,.73],["NASDAQ","Nasdaq Composite",19180.31,1.16],["DOW","Dow Jones",42635.2,.31],["DAX","DAX",20317.1,-.12]],
  forex: [["EUR/USD","Euro / Dólar",1.0428,.22],["GBP/USD","Libra / Dólar",1.2531,-.18],["USD/JPY","Dólar / Yen",157.14,.44],["EUR/GBP","Euro / Libra",.8322,.09]],
  materias: [["ORO","Oro",2648.3,.84],["PLATA","Plata",30.41,1.19],["WTI","Petróleo WTI",73.96,-1.37],["GAS","Gas natural",3.66,2.08]],
};

export const fallbackQuotes = Object.entries(fallbackRows).reduce((acc, [id, rows]) => {
  acc[id as MarketId] = rows.map(([symbol,name,price,change], row) => ({
    symbol: String(symbol), ticker: String(symbol), name: String(name), price: Number(price), change: Number(change),
    currency: "", exchange: "Muestra de respaldo", updatedAt: new Date().toISOString(),
    points: Array.from({ length: 24 }, (_, i) => ({ time: new Date(Date.now() - (23-i)*1800000).toISOString(), value: Number(price) * (1 + Math.sin(i * .8 + row) * .006 + (i-12) * Number(change) / 10000) })),
  }));
  return acc;
}, {} as Record<MarketId, MarketQuote[]>);

export const getFlight = (change: number) => change >= 2.5 ? { label: "DESPEGANDO", color: "emerald", score: 88 } : change >= .5 ? { label: "EN ASCENSO", color: "blue", score: 74 } : change <= -2.5 ? { label: "DESCENSO FUERTE", color: "rose", score: 28 } : change < -.5 ? { label: "DESCENDIENDO", color: "amber", score: 42 } : { label: "ESTABLE", color: "slate", score: 58 };

export const formatPrice = (quote: MarketQuote) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: quote.price < 10 ? 4 : 2, maximumFractionDigits: quote.price < 10 ? 5 : 2 }).format(quote.price);

export const utilityItems = [
  { icon: Bot, title: "Bot Vigía", text: "Avisa cuando el ARES mínimo se cumple." },
  { icon: BadgeDollarSign, title: "Stop limit educativo", text: "Aprende a definir activación y precio límite." },
];
