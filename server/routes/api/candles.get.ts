import { defineHandler } from "nitro";
import { createError, getQuery } from "nitro/h3";

type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number | null };

const allowedMarkets = new Set(["acciones", "europa", "cripto", "etfs", "fondos", "pequenas", "indices", "forex", "materias"]);
const horizonDays = [35, 14, 45, 210, 390];

function numeric(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function validateSymbol(value: unknown) {
  const symbol = String(value ?? "").toLowerCase();
  if (!/^[a-z0-9.^_-]{1,80}$/.test(symbol)) throw createError({ statusCode: 400, statusMessage: "Símbolo no válido" });
  return symbol;
}

async function stooqCandles(symbol: string, horizon: number) {
  const end = new Date();
  const start = new Date(Date.now() - horizonDays[horizon] * 86_400_000);
  const date = (value: Date) => value.toISOString().slice(0, 10).replace(/-/g, "");
  const response = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${date(start)}&d2=${date(end)}&i=d`, {
    headers: { "User-Agent": "Mozilla/5.0 ARES-Vigia/13", Accept: "text/csv" }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Stooq HTTP ${response.status}`);
  const candles = (await response.text()).trim().split(/\r?\n/).slice(1).flatMap((line): Candle[] => {
    const fields = line.split(",");
    const open = numeric(fields[1]), high = numeric(fields[2]), low = numeric(fields[3]), close = numeric(fields[4]), volume = numeric(fields[5]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields[0]) || open === null || high === null || low === null || close === null || Math.min(open, high, low, close) <= 0) return [];
    return [{ time: `${fields[0]}T16:00:00Z`, open, high, low, close, volume }];
  });
  return { candles, provider: "Stooq · histórico OHLC oficial", resolution: "1 día" };
}

async function cryptoCandles(id: string, horizon: number) {
  const days = ([1, 7, 30, 365, 365] as const)[horizon];
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`, {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const payload = await response.json();
  let candles: Candle[] = (Array.isArray(payload) ? payload : []).flatMap((row): Candle[] => {
    if (!Array.isArray(row) || row.length < 5) return [];
    const time = numeric(row[0]), open = numeric(row[1]), high = numeric(row[2]), low = numeric(row[3]), close = numeric(row[4]);
    if (time === null || open === null || high === null || low === null || close === null) return [];
    return [{ time: new Date(time).toISOString(), open, high, low, close, volume: null }];
  });
  if (horizon === 3) candles = candles.filter((item) => Date.parse(item.time) >= Date.now() - 190 * 86_400_000);
  const resolution = horizon === 0 ? "30 minutos" : horizon === 1 ? "4 horas" : "4 días";
  return { candles, provider: "CoinGecko · OHLC", resolution };
}

async function yahooCandles(symbol: string, horizon: number) {
  const range = (["1mo", "1mo", "3mo", "1y", "2y"] as const)[horizon];
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 ARES-Vigia/13" }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Yahoo respaldo HTTP ${response.status}`);
  const payload = await response.json() as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> } }> } };
  const result = payload.chart?.result?.[0], quote = result?.indicators?.quote?.[0], stamps = result?.timestamp ?? [];
  const candles = stamps.flatMap((stamp, index): Candle[] => {
    const open = numeric(quote?.open?.[index]), high = numeric(quote?.high?.[index]), low = numeric(quote?.low?.[index]), close = numeric(quote?.close?.[index]), volume = numeric(quote?.volume?.[index]);
    return open !== null && high !== null && low !== null && close !== null && Math.min(open, high, low, close) > 0 ? [{ time: new Date(stamp * 1000).toISOString(), open, high, low, close, volume }] : [];
  });
  return { candles, provider: "Yahoo Finance · respaldo final OHLC", resolution: "1 día" };
}

export default defineHandler(async (event) => {
  const query = getQuery(event);
  const market = String(query.market ?? "").toLowerCase();
  if (!allowedMarkets.has(market)) throw createError({ statusCode: 400, statusMessage: "Mercado no válido" });
  const symbol = validateSymbol(query.symbol);
  const horizon = Math.max(0, Math.min(4, Number.parseInt(String(query.horizon ?? "0"), 10) || 0));
  try {
    let result;
    if (market === "cripto") result = await cryptoCandles(symbol, horizon);
    else {
      try { result = await stooqCandles(symbol, horizon); }
      catch { result = await yahooCandles(symbol, horizon); }
    }
    return {
      market, symbol, horizon, ...result, updatedAt: new Date().toISOString(),
      error: result.candles.length ? null : "SIN DATOS – FUENTE NO DISPONIBLE",
    };
  } catch (error) {
    return {
      market, symbol, horizon, candles: [], provider: market === "cripto" ? "CoinGecko" : "Stooq / Yahoo (respaldo)", resolution: "no disponible",
      updatedAt: new Date().toISOString(), error: `SIN DATOS – FUENTE NO DISPONIBLE${error instanceof Error ? ` · ${error.message}` : ""}`,
    };
  }
});
