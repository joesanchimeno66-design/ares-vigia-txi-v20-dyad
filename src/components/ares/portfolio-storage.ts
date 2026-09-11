export type PortfolioCategory = "Acciones" | "Criptomonedas" | "ETFs" | "Índices" | "Materias Primas" | "Forex";
export type OperationType = "COMPRA" | "VENTA";
export type AlertKind = "beneficio" | "pérdida" | "volumen" | "tendencia";

export type PortfolioOperation = {
  id: string;
  ticker: string;
  name: string;
  category: PortfolioCategory;
  type: OperationType;
  quantity: number;
  price: number;
  date: string;
};

export type PortfolioAlert = {
  id: string;
  ticker: string;
  kind: AlertKind;
  threshold: number;
  active: boolean;
};

export type PortfolioSnapshot = {
  date: string;
  value: number;
  benchmark: number;
};

export type PortfolioState = {
  operations: PortfolioOperation[];
  alerts: PortfolioAlert[];
  benchmark: string;
  snapshots: PortfolioSnapshot[];
};

const storageKey = "ares-portfolio-v1";

const sampleOperations: PortfolioOperation[] = [
  { id: "op-aapl", ticker: "AAPL", name: "Apple", category: "Acciones", type: "COMPRA", quantity: 12, price: 182.4, date: "2025-02-12" },
  { id: "op-msft", ticker: "MSFT", name: "Microsoft", category: "Acciones", type: "COMPRA", quantity: 6, price: 398.2, date: "2025-03-04" },
  { id: "op-btc", ticker: "BTC", name: "Bitcoin", category: "Criptomonedas", type: "COMPRA", quantity: 0.045, price: 62400, date: "2025-01-18" },
  { id: "op-spy", ticker: "SPY", name: "SPDR S&P 500 ETF", category: "ETFs", type: "COMPRA", quantity: 8, price: 534.6, date: "2025-04-09" },
  { id: "op-ibex", ticker: "IBEX 35", name: "IBEX 35", category: "Índices", type: "COMPRA", quantity: 0.18, price: 11640, date: "2025-05-15" },
  { id: "op-gold", ticker: "ORO", name: "Oro", category: "Materias Primas", type: "COMPRA", quantity: 0.6, price: 2325, date: "2025-02-27" },
  { id: "op-eurusd", ticker: "EUR/USD", name: "Euro / Dólar", category: "Forex", type: "COMPRA", quantity: 1450, price: 1.074, date: "2025-06-10" },
];

const sampleAlerts: PortfolioAlert[] = [
  { id: "alert-aapl", ticker: "AAPL", kind: "beneficio", threshold: 12, active: true },
  { id: "alert-btc", ticker: "BTC", kind: "pérdida", threshold: -8, active: true },
  { id: "alert-spy", ticker: "SPY", kind: "tendencia", threshold: 0, active: true },
];

function sampleSnapshots(): PortfolioSnapshot[] {
  const result: PortfolioSnapshot[] = [];
  const start = new Date();
  start.setDate(start.getDate() - 365);
  for (let index = 0; index < 366; index++) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const drift = index * 7.5;
    const wave = Math.sin(index / 13) * 260 + Math.cos(index / 31) * 130;
    result.push({ date: date.toISOString().slice(0, 10), value: 16520 + drift + wave, benchmark: 100 + index * .04 + Math.sin(index / 19) * 1.4 });
  }
  return result;
}

export const sampleCurrentPrices: Record<string, number> = {
  AAPL: 211.18, MSFT: 462.97, BTC: 68320, SPY: 596.31, "IBEX 35": 13245.6, ORO: 2672.4, "EUR/USD": 1.0912,
};

export const portfolioRepository = {
  load(): PortfolioState {
    const fallback = { operations: sampleOperations, alerts: sampleAlerts, benchmark: "S&P 500", snapshots: sampleSnapshots() };
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return fallback;
      const parsed = JSON.parse(stored) as Partial<PortfolioState>;
      if (!Array.isArray(parsed.operations) || !Array.isArray(parsed.alerts) || !Array.isArray(parsed.snapshots)) return fallback;
      return { operations: parsed.operations, alerts: parsed.alerts, benchmark: parsed.benchmark || "S&P 500", snapshots: parsed.snapshots };
    } catch {
      return fallback;
    }
  },
  save(state: PortfolioState) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  },
};
