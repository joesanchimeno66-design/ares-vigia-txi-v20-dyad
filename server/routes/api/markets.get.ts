import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";

type Instrument = { symbol: string; label: string; name: string; code?: string };
type Quote = {
  symbol: string;
  ticker: string;
  name: string;
  price: number;
  change: number;
  currency: string;
  exchange: string;
  updatedAt: string;
  points: { time: string; value: number }[];
};

const usMarkets: Record<string, Instrument[]> = {
  acciones: [
    ["AAPL", "Apple"], ["NVDA", "NVIDIA"], ["MSFT", "Microsoft"], ["AMZN", "Amazon"],
    ["META", "Meta"], ["TSLA", "Tesla"], ["GOOGL", "Alphabet"], ["AMD", "AMD"],
    ["JPM", "JPMorgan Chase"], ["SAN", "Banco Santander"], ["PLTR", "Palantir"], ["NFLX", "Netflix"],
  ].map(([symbol, name]) => ({ symbol, label: symbol, name, code: `us${symbol}` })),
  etfs: [
    ["SPY", "SPDR S&P 500 ETF"], ["QQQ", "Invesco QQQ"], ["VOO", "Vanguard S&P 500"],
    ["VTI", "Vanguard Total Market"], ["IWM", "iShares Russell 2000"], ["GLD", "SPDR Gold Shares"],
    ["IBIT", "iShares Bitcoin Trust"], ["ARKK", "ARK Innovation"],
  ].map(([symbol, name]) => ({ symbol, label: symbol, name, code: `us${symbol}` })),
};

const european: Instrument[] = [
  ["san.es", "SAN", "Banco Santander"], ["ibe.es", "IBE", "Iberdrola"], ["itx.es", "ITX", "Inditex"],
  ["sap.de", "SAP", "SAP"], ["sie.de", "SIE", "Siemens"], ["air.fr", "AIR", "Airbus"],
  ["mc.fr", "MC", "LVMH"], ["asml.nl", "ASML", "ASML"], ["shel.uk", "SHEL", "Shell"],
].map(([symbol, label, name]) => ({ symbol, label, name }));

const crypto: Instrument[] = [
  ["bitcoin", "BTC", "Bitcoin"], ["ethereum", "ETH", "Ethereum"], ["binancecoin", "BNB", "BNB"],
  ["solana", "SOL", "Solana"], ["ripple", "XRP", "XRP"], ["cardano", "ADA", "Cardano"],
  ["dogecoin", "DOGE", "Dogecoin"], ["avalanche-2", "AVAX", "Avalanche"], ["chainlink", "LINK", "Chainlink"],
].map(([symbol, label, name]) => ({ symbol, label, name }));

const forex: Instrument[] = [
  ["EUR/USD", "Euro / Dólar"], ["GBP/USD", "Libra / Dólar"], ["USD/JPY", "Dólar / Yen"],
  ["USD/CHF", "Dólar / Franco suizo"], ["AUD/USD", "Dólar australiano / Dólar"],
  ["EUR/GBP", "Euro / Libra"], ["EUR/JPY", "Euro / Yen"],
].map(([symbol, name]) => ({ symbol, label: symbol, name, code: `wh${symbol.replace("/", "")}` }));

const commodities: Instrument[] = [
  ["GC", "ORO", "Oro"], ["SI", "PLATA", "Plata"], ["CL", "WTI", "Petróleo WTI"],
  ["OIL", "BRENT", "Petróleo Brent"], ["NG", "GAS", "Gas natural"], ["CAD", "COBRE", "Cobre"],
  ["W", "TRIGO", "Trigo"], ["C", "MAÍZ", "Maíz"], ["KC", "CAFÉ", "Café"],
].map(([code, label, name]) => ({ symbol: code, label, name, code: `hf_${code}` }));

const indices: Instrument[] = [
  ["^ibex", "IBEX 35", "IBEX 35"], ["^spx", "S&P 500", "S&P 500"],
  ["^ndq", "NASDAQ", "Nasdaq Composite"], ["^dji", "DOW", "Dow Jones"],
  ["^stoxx50e", "EURO50", "Euro Stoxx 50"], ["^dax", "DAX", "DAX"],
  ["^nkx", "NIKKEI", "Nikkei 225"], ["^hsi", "HANG SENG", "Hang Seng"],
].map(([symbol, label, name]) => ({ symbol, label, name }));

const funds: Instrument[] = [
  ["vfiax.us", "VFIAX", "Vanguard 500 Index Admiral"], ["vtsax.us", "VTSAX", "Vanguard Total Market"],
  ["fxaix.us", "FXAIX", "Fidelity 500 Index"], ["fskax.us", "FSKAX", "Fidelity Total Market"],
  ["swppx.us", "SWPPX", "Schwab S&P 500 Index"], ["vwelx.us", "VWELX", "Vanguard Wellington"],
].map(([symbol, label, name]) => ({ symbol, label, name }));

const smallCaps: Instrument[] = [
  ["soun.us", "SOUN", "SoundHound AI"], ["bbai.us", "BBAI", "BigBear.ai"],
  ["lunr.us", "LUNR", "Intuitive Machines"], ["rklb.us", "RKLB", "Rocket Lab"],
  ["ionq.us", "IONQ", "IonQ"], ["rgti.us", "RGTI", "Rigetti Computing"],
].map(([symbol, label, name]) => ({ symbol, label, name }));

const stooqFallback: Record<string, string> = {
  AAPL: "aapl.us", NVDA: "nvda.us", MSFT: "msft.us", AMZN: "amzn.us", META: "meta.us", TSLA: "tsla.us",
  GOOGL: "googl.us", AMD: "amd.us", JPM: "jpm.us", SAN: "san.us", PLTR: "pltr.us", NFLX: "nflx.us",
  SPY: "spy.us", QQQ: "qqq.us", VOO: "voo.us", VTI: "vti.us", IWM: "iwm.us", GLD: "gld.us", IBIT: "ibit.us", ARKK: "arkk.us",
};

function number(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTencentLines(text: string) {
  const rows = new Map<string, string>();
  for (const raw of text.replace(/\r|\n/g, "").split(";")) {
    if (!raw.includes("=")) continue;
    const [left, ...right] = raw.split("=");
    const key = left.trim().replace("var ", "").replace("hq_str_", "").replace("v_", "").toLowerCase();
    const value = right.join("=").trim().replace(/^"|"$/g, "");
    if (key && value) rows.set(key, value);
  }
  return rows;
}

async function tencentText(codes: string[]) {
  const response = await fetch(`https://qt.gtimg.cn/q=${codes.join(",")}`, {
    headers: { "User-Agent": "Mozilla/5.0 ARES-Vigia/13", Referer: "https://gu.qq.com/", Accept: "*/*" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Tencent HTTP ${response.status}`);
  return new TextDecoder("gbk").decode(await response.arrayBuffer());
}

function quoteFromSnapshot(instrument: Instrument, price: number, change: number, provider: string, updatedAt?: string): Quote {
  const iso = updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? new Date(updatedAt).toISOString() : new Date().toISOString();
  return {
    symbol: instrument.label,
    ticker: instrument.symbol,
    name: instrument.name,
    price,
    change,
    currency: "",
    exchange: provider,
    updatedAt: iso,
    points: [{ time: iso, value: price }],
  };
}

async function fetchTencentUs(instruments: Instrument[]) {
  const rows = parseTencentLines(await tencentText(instruments.map((item) => item.code!)));
  return instruments.flatMap((instrument) => {
    const fields = rows.get(instrument.code!.toLowerCase())?.split("~") ?? [];
    const price = number(fields[3]);
    const change = number(fields[32]);
    if (price === null || price <= 0 || change === null) return [];
    const rawTime = fields[30];
    const updatedAt = /^\d{14}$/.test(rawTime ?? "")
      ? `${rawTime.slice(0,4)}-${rawTime.slice(4,6)}-${rawTime.slice(6,8)}T${rawTime.slice(8,10)}:${rawTime.slice(10,12)}:${rawTime.slice(12,14)}-04:00`
      : undefined;
    return [quoteFromSnapshot(instrument, price, change, "Tencent Finance · mercado USA", updatedAt)];
  });
}

async function fetchTencentForex() {
  const rows = parseTencentLines(await tencentText(forex.map((item) => item.code!)));
  return forex.flatMap((instrument) => {
    const fields = rows.get(instrument.code!.toLowerCase())?.split("~") ?? [];
    const price = number(fields[3]);
    const change = number(fields[13]);
    if (price === null || price <= 0 || change === null) return [];
    return [quoteFromSnapshot(instrument, price, change, "Tencent Finance · FOREX")];
  });
}

async function financeText(host: "Tencent" | "Sina", codes: string[]) {
  if (host === "Tencent") return tencentText(codes);
  const response = await fetch(`https://hq.sinajs.cn/list=${codes.join(",")}`, {
    headers: { "User-Agent": "Mozilla/5.0 ARES-Vigia/13", Referer: "https://finance.sina.com.cn/", Accept: "*/*" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Sina HTTP ${response.status}`);
  return new TextDecoder("gbk").decode(await response.arrayBuffer());
}

async function fetchCommodities() {
  for (const host of ["Tencent", "Sina"] as const) {
    try {
      const rows = parseTencentLines(await financeText(host, commodities.map((item) => item.code!)));
      const quotes = commodities.flatMap((instrument) => {
        const fields = rows.get(instrument.code!.toLowerCase())?.split(",") ?? [];
        const price = number(fields[0]);
        const change = number(fields[1]);
        if (price === null || price <= 0 || change === null) return [];
        const date = fields[12];
        const time = fields[6];
        const updatedAt = date && time ? `${date}T${time}+08:00` : undefined;
        return [quoteFromSnapshot(instrument, price, change, `${host} Finance · materias primas`, updatedAt)];
      });
      if (quotes.length) return quotes;
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchCoinGecko() {
  const ids = crypto.map((item) => item.symbol).join(",");
  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("ids", ids);
  url.searchParams.set("sparkline", "true");
  url.searchParams.set("price_change_percentage", "24h");
  url.searchParams.set("precision", "full");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const payload = await response.json();
  const byId = new Map((Array.isArray(payload) ? payload : []).map((item) => [String(item.id), item]));
  return crypto.flatMap((instrument) => {
    const item = byId.get(instrument.symbol);
    const price = number(item?.current_price);
    const change = number(item?.price_change_percentage_24h);
    if (price === null || price <= 0 || change === null) return [];
    const prices: number[] = Array.isArray(item?.sparkline_in_7d?.price) ? item.sparkline_in_7d.price : [];
    const end = Date.parse(item?.last_updated ?? "") || Date.now();
    const step = prices.length > 1 ? (7 * 24 * 60 * 60 * 1000) / (prices.length - 1) : 0;
    const points = prices.flatMap((value, index) => Number.isFinite(value) ? [{ time: new Date(end - (prices.length - 1 - index) * step).toISOString(), value }] : []).slice(-80);
    const quote = quoteFromSnapshot(instrument, price, change, "CoinGecko · mercado cripto", item?.last_updated);
    quote.currency = "USD";
    quote.points = points.length ? points : quote.points;
    return [quote];
  });
}

async function fetchStooq(instrument: Instrument, symbol = instrument.symbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ARES-Vigia/13" }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Stooq HTTP ${response.status}`);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const fields = lines.at(-1)?.split(",") ?? [];
  const open = number(fields[3]);
  const close = number(fields[6]);
  if (open === null || close === null || open <= 0 || close <= 0) throw new Error("Stooq sin cotización");
  const change = ((close - open) / open) * 100;
  const updatedAt = fields[1] && fields[2] ? `${fields[1]}T${fields[2]}Z` : undefined;
  return quoteFromSnapshot(instrument, close, Number(change.toFixed(2)), "Stooq · mercado público", updatedAt);
}

async function fetchStooqSet(instruments: Instrument[]) {
  const results = await Promise.allSettled(instruments.map((item) => fetchStooq(item)));
  return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

async function fetchUsMarket(market: "acciones" | "etfs") {
  const instruments = usMarkets[market];
  let primary: Quote[] = [];
  try { primary = await fetchTencentUs(instruments); } catch { primary = []; }
  const received = new Set(primary.map((item) => item.symbol));
  const missing = instruments.filter((item) => !received.has(item.label));
  const secondaryResults = await Promise.allSettled(missing.map((item) => fetchStooq(item, stooqFallback[item.symbol])));
  return [...primary, ...secondaryResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])];
}

async function loadMarket(market: string): Promise<{ requested: number; items: Quote[]; providers: string[] }> {
  if (market === "acciones" || market === "etfs") {
    const items = await fetchUsMarket(market);
    return { requested: usMarkets[market].length, items, providers: ["Tencent Finance", "Stooq"] };
  }
  if (market === "europa") return { requested: european.length, items: await fetchStooqSet(european), providers: ["Stooq"] };
  if (market === "cripto") return { requested: crypto.length, items: await fetchCoinGecko(), providers: ["CoinGecko"] };
  if (market === "indices") return { requested: indices.length, items: await fetchStooqSet(indices), providers: ["Stooq"] };
  if (market === "forex") return { requested: forex.length, items: await fetchTencentForex(), providers: ["Tencent Finance"] };
  if (market === "materias") return { requested: commodities.length, items: await fetchCommodities(), providers: ["Tencent Finance", "Sina Finance"] };
  if (market === "fondos") return { requested: funds.length, items: await fetchStooqSet(funds), providers: ["Stooq"] };
  if (market === "pequenas") return { requested: smallCaps.length, items: await fetchStooqSet(smallCaps), providers: ["Stooq"] };
  return { requested: 0, items: [], providers: [] };
}

export default defineHandler(async (event) => {
  const market = String(getQuery(event).market ?? "acciones").toLowerCase();
  try {
    const { requested, items, providers } = await loadMarket(market);
    if (!requested) return { market, mode: "error", provider: "ninguno", items: [], requested: 0, failures: 0, error: "Mercado no válido" };
    const failures = requested - items.length;
    return {
      market,
      mode: items.length === requested ? "real" : items.length ? "mixto" : "sin-datos",
      provider: providers.join(" / "),
      updatedAt: new Date().toISOString(),
      requested,
      failures,
      items,
      error: items.length ? null : "SIN DATOS – FUENTE NO DISPONIBLE",
    };
  } catch (error) {
    return {
      market,
      mode: "sin-datos",
      provider: "fuentes alternativas no disponibles",
      updatedAt: new Date().toISOString(),
      requested: 0,
      failures: 0,
      items: [],
      error: `SIN DATOS – FUENTE NO DISPONIBLE${error instanceof Error ? ` · ${error.message}` : ""}`,
    };
  }
});
