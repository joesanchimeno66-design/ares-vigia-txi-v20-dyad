import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";
import { tradingViewDaily } from "../../utils/tradingview";

type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number | null };
type CandleResult = { candles: Candle[]; provider: string; resolution: string };

const allowedMarkets = new Set(["acciones", "europa", "cripto", "etfs", "fondos", "pequenas", "indices", "forex", "materias"]);
const horizonDays = [2, 10, 45, 210, 390];
const minimumCandles = [3, 5, 20, 45, 60];

function numeric(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function validateSymbol(value: unknown) {
  const symbol = String(value ?? "").toLowerCase();
  if (!/^[a-z0-9.^_/-]{1,80}$/.test(symbol)) throw createError({ statusCode: 400, statusMessage: "Símbolo no válido" });
  return symbol;
}

function validateTicker(value: unknown) {
  const ticker = String(value ?? "").toUpperCase();
  if (!/^[A-Z0-9.^_/-]{1,30}$/.test(ticker)) throw createError({ statusCode: 400, statusMessage: "Ticker no válido" });
  return ticker;
}

function validCandle(time: string, open: number | null, high: number | null, low: number | null, close: number | null, volume: number | null): Candle[] {
  if (!time || open === null || high === null || low === null || close === null || Math.min(open, high, low, close) <= 0 || high < Math.max(open, close) || low > Math.min(open, close)) return [];
  const parsedTime = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T16:00:00Z` : new Date(time.replace(" ", "T") + (/Z$|[+-]\d\d:\d\d$/.test(time) ? "" : "Z")).toISOString();
  return [{ time: parsedTime, open, high, low, close, volume }];
}

function ensureCoverage(result: CandleResult, horizon: number) {
  const unique = [...new Map(result.candles.map((candle) => [candle.time, candle])).values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (unique.length < minimumCandles[horizon]) throw new Error(`${result.provider}: histórico insuficiente (${unique.length}/${minimumCandles[horizon]})`);
  return { ...result, candles: unique };
}

async function tencentCandles(ticker: string, horizon: number): Promise<CandleResult> {
  const code = `us${ticker}`;
  const period = horizon === 0 ? "m5" : "day";
  const limit = horizon === 0 ? 320 : [0, 12, 50, 220, 420][horizon];
  const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(`${code},${period},,,${limit},qfq`)}`, {
    headers: { Accept: "application/json", Referer: "https://gu.qq.com/", "User-Agent": "Mozilla/5.0 ARES-Vigia/13" }, signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Tencent OHLC HTTP ${response.status}`);
  const payload = await response.json() as { data?: Record<string, Record<string, unknown>> };
  const bucket = payload.data?.[code];
  const rows = (bucket?.[`qfq${period}`] ?? bucket?.[period]) as unknown;
  const candles = (Array.isArray(rows) ? rows : []).flatMap((row): Candle[] => {
    if (!Array.isArray(row)) return [];
    return validCandle(String(row[0] ?? ""), numeric(row[1]), numeric(row[3]), numeric(row[4]), numeric(row[2]), numeric(row[5]));
  });
  return ensureCoverage({ candles, provider: "Tencent · OHLC real", resolution: horizon === 0 ? "5 minutos" : "1 día" }, horizon);
}

async function eastmoneySecid(ticker: string) {
  const suggest = new URL("https://searchapi.eastmoney.com/api/suggest/get");
  suggest.searchParams.set("input", ticker);
  suggest.searchParams.set("type", "14");
  suggest.searchParams.set("token", "D43BF722C8E33BDC906FB84D85E326E8");
  const response = await fetch(suggest, { headers: { Accept: "application/json", Referer: "https://quote.eastmoney.com/" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Eastmoney búsqueda HTTP ${response.status}`);
  const payload = await response.json() as { QuotationCodeTable?: { Data?: Array<{ Code?: string; QuoteID?: string }> } };
  const match = payload.QuotationCodeTable?.Data?.find((item) => String(item.Code ?? "").toUpperCase() === ticker);
  if (!match?.QuoteID) throw new Error("Eastmoney sin identificador exacto");
  return match.QuoteID;
}

async function eastmoneyCandles(ticker: string, horizon: number): Promise<CandleResult> {
  const secid = await eastmoneySecid(ticker);
  const interval = horizon === 0 ? 5 : 101;
  const limit = horizon === 0 ? 320 : [0, 12, 50, 220, 420][horizon];
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&klt=${interval}&fqt=1&lmt=${limit}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56`;
  const response = await fetch(url, { headers: { Accept: "application/json", Referer: "https://quote.eastmoney.com/" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Eastmoney OHLC HTTP ${response.status}`);
  const payload = await response.json() as { data?: { klines?: string[] } };
  const candles = (payload.data?.klines ?? []).flatMap((line): Candle[] => {
    const fields = line.split(",");
    return validCandle(fields[0], numeric(fields[1]), numeric(fields[3]), numeric(fields[4]), numeric(fields[2]), numeric(fields[5]));
  });
  return ensureCoverage({ candles, provider: "Eastmoney · OHLC real", resolution: horizon === 0 ? "5 minutos" : "1 día" }, horizon);
}

function tradingViewSymbol(market: string, ticker: string) {
  if (market === "etfs") return `${ticker === "QQQ" ? "NASDAQ" : "AMEX"}:${ticker}`;
  if (market === "fondos" || market === "acciones" || market === "pequenas") return `NASDAQ:${ticker}`;
  if (market === "forex") return `OANDA:${ticker.replace("/", "")}`;
  if (market === "europa") {
    const [base, suffix] = ticker.split(".");
    const exchanges: Record<string, string> = { MC: "BME", DE: "XETR", PA: "EURONEXT", MI: "MIL", AS: "EURONEXT", L: "LSE", LS: "EURONEXT", BR: "EURONEXT", SW: "SIX", CO: "OMXCOP", ST: "OMXSTO", HE: "OMXHEX" };
    return exchanges[suffix] ? `${exchanges[suffix]}:${base}` : null;
  }
  const indices: Record<string, string> = { "^IBEX": "BME:IBC", "^SPX": "SP:SPX", "^NDQ": "NASDAQ:IXIC", "^DJI": "DJ:DJI", "^STOXX50E": "TVC:SX5E", "^DAX": "XETR:DAX", "^CAC": "EURONEXT:PX1", "^UKX": "TVC:UKX", "^NKX": "TVC:NI225", "^HSI": "TVC:HSI" };
  const commodities: Record<string, string> = { GC: "COMEX:GC1!", SI: "COMEX:SI1!", CL: "NYMEX:CL1!", OIL: "NYMEX:BB1!", NG: "NYMEX:NG1!", HG: "COMEX:HG1!", W: "CBOT:ZW1!", C: "CBOT:ZC1!", S: "CBOT:ZS1!", KC: "ICEUS:KC1!", CC: "ICEUS:CC1!" };
  return indices[ticker] ?? commodities[ticker] ?? null;
}

async function tradingViewCandles(market: string, ticker: string, horizon: number): Promise<CandleResult> {
  if (horizon === 0) throw new Error("TradingView diario no sustituye datos intradía");
  const providerSymbol = tradingViewSymbol(market, ticker);
  if (!providerSymbol) throw new Error("TradingView sin símbolo compatible");
  const cutoff = Date.now() - horizonDays[horizon] * 86_400_000;
  const candles = (await tradingViewDaily(providerSymbol, 420))
    .filter(candle => Date.parse(candle.time) >= cutoff)
    .flatMap(candle => validCandle(candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume));
  return ensureCoverage({ candles, provider: "TradingView · OHLC real", resolution: "1 día" }, horizon);
}

async function stooqCandles(symbol: string, horizon: number): Promise<CandleResult> {
  const end = new Date();
  const start = new Date(Date.now() - horizonDays[horizon] * 86_400_000);
  const date = (value: Date) => value.toISOString().slice(0, 10).replace(/-/g, "");
  const response = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${date(start)}&d2=${date(end)}&i=d`, {
    headers: { "User-Agent": "Mozilla/5.0 ARES-Vigia/13", Accept: "text/csv" }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Stooq HTTP ${response.status}`);
  const candles = (await response.text()).trim().split(/\r?\n/).slice(1).flatMap((line): Candle[] => {
    const fields = line.split(",");
    return validCandle(fields[0], numeric(fields[1]), numeric(fields[2]), numeric(fields[3]), numeric(fields[4]), numeric(fields[5]));
  });
  return ensureCoverage({ candles, provider: "Stooq · respaldo OHLC", resolution: "1 día" }, horizon);
}

async function cryptoCandles(id: string, horizon: number): Promise<CandleResult> {
  const days = ([1, 7, 30, 365, 365] as const)[horizon];
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`, {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const payload = await response.json();
  let candles = (Array.isArray(payload) ? payload : []).flatMap((row): Candle[] => Array.isArray(row) && row.length >= 5 ? validCandle(new Date(Number(row[0])).toISOString(), numeric(row[1]), numeric(row[2]), numeric(row[3]), numeric(row[4]), null) : []);
  if (horizon === 3) candles = candles.filter((item) => Date.parse(item.time) >= Date.now() - 190 * 86_400_000);
  const resolution = horizon === 0 ? "30 minutos" : horizon === 1 ? "4 horas" : "4 días";
  return ensureCoverage({ candles, provider: "CoinGecko · OHLC real", resolution }, horizon);
}

export default defineHandler(async (event) => {
  const query = getQuery(event);
  const market = String(query.market ?? "").toLowerCase();
  if (!allowedMarkets.has(market)) throw createError({ statusCode: 400, statusMessage: "Mercado no válido" });
  const symbol = validateSymbol(query.symbol);
  const ticker = validateTicker(query.ticker ?? query.symbol);
  const horizon = Math.max(0, Math.min(4, Number.parseInt(String(query.horizon ?? "0"), 10) || 0));
  const errors: string[] = [];
  try {
    let result: CandleResult;
    if (market === "cripto") result = await cryptoCandles(symbol, horizon);
    else {
      const providers = [
        () => tencentCandles(ticker, horizon),
        () => eastmoneyCandles(ticker, horizon),
        () => tradingViewCandles(market, ticker, horizon),
        () => stooqCandles(symbol, horizon),
      ];
      let selected: CandleResult | null = null;
      for (const provider of providers) {
        try { selected = await provider(); break; }
        catch (error) { errors.push(error instanceof Error ? error.message : "fuente no disponible"); }
      }
      if (!selected) throw new Error(errors.join(" · "));
      result = selected;
    }
    return { market, symbol, ticker, horizon, ...result, updatedAt: new Date().toISOString(), error: null };
  } catch (error) {
    return {
      market, symbol, ticker, horizon, candles: [], provider: market === "cripto" ? "CoinGecko" : "Tencent / Eastmoney / TradingView / Stooq", resolution: "no disponible",
      updatedAt: new Date().toISOString(), error: `SIN DATOS — FUENTE NO DISPONIBLE${error instanceof Error ? ` · ${error.message}` : ""}`,
    };
  }
});
