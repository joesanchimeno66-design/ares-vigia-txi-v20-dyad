import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Bot, CircleHelp, Clock3, Gauge, LoaderCircle,
  Play, RefreshCw, Save, Settings2, ShieldCheck, Sparkles, Target, TrendingDown,
  TrendingUp, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MarketCandle, MarketId, MarketQuote } from "./market-config";
import {
  botConfigurationRepository, type BotConfigurationState, type BotMode, type BotRisk,
} from "./bot-storage";

type QuoteResponse = { items?: MarketQuote[]; provider?: string; error?: string | null };
type CandleResponse = { candles?: MarketCandle[]; provider?: string; resolution?: string; updatedAt?: string; error?: string | null };
type Trend = "SUBIENDO" | "NEUTRAL" | "BAJANDO";

type Analysis = {
  trend: Trend; rsi: number | null; bollinger: string; volume: string; macd: string;
  support: number | null; resistance: number | null; volatility: number | null;
  confidence: number; reason: string; invalidation: string; stop: number | null;
  target: number | null; risk: BotRisk; updatedAt: string; provider: string;
  resolution: string; availableSignals: number; alignedSignals: number;
};

const botModes: Array<{ id: BotMode; title: string; period: string; text: string; color: string }> = [
  { id: "corto", title: "BOT CORTO", period: "30 minutos", text: "Movimientos rápidos e intradía.", color: "blue" },
  { id: "medio", title: "BOT MEDIO", period: "4 horas", text: "Operaciones de varios días.", color: "violet" },
  { id: "tendencia", title: "BOT TENDENCIA", period: "1 día", text: "Movimientos de mayor duración.", color: "emerald" },
];

const assets: Array<{ id: string; market: MarketId; ticker: string; label: string }> = [
  { id: "acciones:AAPL", market: "acciones", ticker: "AAPL", label: "Apple · AAPL" },
  { id: "acciones:NVDA", market: "acciones", ticker: "NVDA", label: "NVIDIA · NVDA" },
  { id: "etfs:SPY", market: "etfs", ticker: "SPY", label: "S&P 500 ETF · SPY" },
  { id: "etfs:QQQ", market: "etfs", ticker: "QQQ", label: "Nasdaq 100 ETF · QQQ" },
  { id: "cripto:bitcoin", market: "cripto", ticker: "bitcoin", label: "Bitcoin · BTC" },
  { id: "cripto:ethereum", market: "cripto", ticker: "ethereum", label: "Ethereum · ETH" },
  { id: "forex:EUR/USD", market: "forex", ticker: "EUR/USD", label: "Euro / Dólar · EUR/USD" },
  { id: "indices:^spx", market: "indices", ticker: "^spx", label: "S&P 500 · Índice" },
  { id: "materias:GC", market: "materias", ticker: "GC", label: "Oro · Materia prima" },
];

const periods = ["30 minutos", "1 hora", "4 horas", "1 día", "1 semana"];
const objectives = ["Capturar impulso rápido", "Movimiento de varios días", "Seguir la tendencia principal", "Proteger capital", "Esperar ruptura confirmada"];
const risks: BotRisk[] = ["BAJO", "MEDIO", "ALTO"];

function ema(values: number[], period: number) {
  if (!values.length) return null;
  const factor = 2 / (period + 1);
  return values.slice(1).reduce((current, value) => value * factor + current * (1 - factor), values[0]);
}

function emaSeries(values: number[], period: number) {
  if (!values.length) return [];
  const factor = 2 / (period + 1), output = [values[0]];
  for (const value of values.slice(1)) output.push(value * factor + output[output.length - 1] * (1 - factor));
  return output;
}

function calculateRsi(values: number[], period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let index = values.length - period; index < values.length; index++) {
    const change = values[index] - values[index - 1];
    gains += Math.max(change, 0); losses += Math.max(-change, 0);
  }
  if (!losses) return 100;
  const relativeStrength = (gains / period) / (losses / period);
  return 100 - 100 / (1 + relativeStrength);
}

function formatValue(value: number | null, currency = "") {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: value < 10 ? 4 : 2, maximumFractionDigits: value < 10 ? 5 : 2 }).format(value)}${currency ? ` ${currency}` : ""}`;
}

function analyzeConfluence(candles: MarketCandle[], quote: MarketQuote, response: CandleResponse, risk: BotRisk): Analysis {
  const closes = candles.map((item) => item.close).filter(Number.isFinite);
  const last = closes.at(-1) ?? quote.price;
  const e9 = closes.length >= 9 ? ema(closes, 9) : null;
  const e21 = closes.length >= 21 ? ema(closes, 21) : null;
  const trend: Trend = e9 !== null && e21 !== null ? (e9 > e21 * 1.002 ? "SUBIENDO" : e9 < e21 * .998 ? "BAJANDO" : "NEUTRAL") : quote.metrics.trend === "alcista" ? "SUBIENDO" : quote.metrics.trend === "bajista" ? "BAJANDO" : "NEUTRAL";
  const direction = trend === "SUBIENDO" ? 1 : trend === "BAJANDO" ? -1 : 0;
  const rsi = calculateRsi(closes) ?? quote.metrics.rsi14;

  let bollinger = "SIN DATO", bollingerVote: number | null = null;
  if (closes.length >= 20) {
    const window = closes.slice(-20), mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const deviation = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length);
    const upper = mean + deviation * 2, lower = mean - deviation * 2;
    bollinger = last >= upper ? "SOBRE BANDA SUPERIOR" : last <= lower ? "BAJO BANDA INFERIOR" : last >= mean ? "MITAD SUPERIOR" : "MITAD INFERIOR";
    bollingerVote = last > mean ? 1 : last < mean ? -1 : 0;
  }

  let macd = "SIN DATO", macdVote: number | null = null;
  if (closes.length >= 35) {
    const fast = emaSeries(closes, 12), slow = emaSeries(closes, 26);
    const line = fast.map((value, index) => value - slow[index]);
    const signal = ema(line.slice(-9), 9), current = line.at(-1) ?? null;
    if (current !== null && signal !== null) { macdVote = current > signal ? 1 : -1; macd = current > signal ? "ALCISTA" : "BAJISTA"; }
  }

  const volumeValues = candles.map((item) => item.volume).filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  let volume = "SIN DATO DEL PROVEEDOR", volumeVote: number | null = null;
  if (volumeValues.length >= 6) {
    const current = volumeValues.at(-1)!, average = volumeValues.slice(-21, -1).reduce((sum, value) => sum + value, 0) / Math.max(1, volumeValues.slice(-21, -1).length);
    const ratio = current / average;
    volume = ratio >= 1.2 ? `ALTO · ${ratio.toFixed(2)}× media` : ratio <= .8 ? `BAJO · ${ratio.toFixed(2)}× media` : `NORMAL · ${ratio.toFixed(2)}× media`;
    volumeVote = ratio >= 1.1 ? direction : ratio <= .8 ? -direction : 0;
  }

  const range = candles.slice(-Math.min(30, candles.length));
  const support = range.length ? Math.min(...range.map((item) => item.low)) : null;
  const resistance = range.length ? Math.max(...range.map((item) => item.high)) : null;
  const proximity = support !== null && resistance !== null && resistance > support ? (last - support) / (resistance - support) : .5;
  const levelVote = direction > 0 && proximity >= .55 ? 1 : direction < 0 && proximity <= .45 ? -1 : 0;
  const rsiVote = rsi === null ? null : rsi >= 52 && rsi <= 68 ? 1 : rsi <= 48 && rsi >= 32 ? -1 : rsi > 75 ? -1 : rsi < 25 ? 1 : 0;
  const trendVote = direction;

  const returns = closes.slice(-31).flatMap((value, index, array) => index && array[index - 1] > 0 ? [(value - array[index - 1]) / array[index - 1]] : []);
  const volatility = returns.length >= 2 ? Math.sqrt(returns.reduce((sum, value) => sum + value ** 2, 0) / returns.length) * Math.sqrt(252) * 100 : quote.metrics.volatility;
  const votes = [trendVote, volumeVote, rsiVote, bollingerVote, macdVote, levelVote].filter((value): value is number => value !== null);
  const positive = votes.filter((value) => value > 0).length, negative = votes.filter((value) => value < 0).length;
  const signalDirection = positive > negative ? 1 : negative > positive ? -1 : 0;
  const alignedSignals = Math.max(positive, negative), availableSignals = votes.length;
  let confidence = 30 + alignedSignals * 9 + Math.max(0, Math.abs(positive - negative) - 1) * 3;
  if (availableSignals < 6 || alignedSignals < 5) confidence = Math.min(confidence, 74);
  if (volumeVote === null) confidence = Math.min(confidence, 68);
  if (signalDirection === 0) confidence = Math.min(confidence, 45);
  confidence = Math.max(22, Math.min(92, Math.round(confidence)));

  const riskFactor = risk === "BAJO" ? .012 : risk === "MEDIO" ? .022 : .035;
  const stop = signalDirection > 0 ? Math.max(support ?? last * (1 - riskFactor), last * (1 - riskFactor)) : signalDirection < 0 ? Math.min(resistance ?? last * (1 + riskFactor), last * (1 + riskFactor)) : support;
  const target = signalDirection > 0 ? Math.min(resistance ?? last * (1 + riskFactor * 2), last * (1 + riskFactor * 2.2)) : signalDirection < 0 ? Math.max(support ?? last * (1 - riskFactor * 2), last * (1 - riskFactor * 2.2)) : resistance;
  const confirmations = [trend !== "NEUTRAL" ? `tendencia ${trend.toLowerCase()}` : null, volumeVote !== null ? `volumen ${volume.toLowerCase()}` : null, rsi !== null ? `RSI ${rsi.toFixed(1)}` : null, bollinger !== "SIN DATO" ? `Bollinger en ${bollinger.toLowerCase()}` : null, macd !== "SIN DATO" ? `MACD ${macd.toLowerCase()}` : null].filter(Boolean);
  const reason = signalDirection === 0 ? "Las lecturas se contradicen. ARES espera una confluencia más clara antes de elevar la confianza." : `${alignedSignals} de ${availableSignals} lecturas disponibles coinciden: ${confirmations.join(", ")}.`;
  const invalidation = signalDirection > 0 ? `La lectura pierde validez si el precio rompe el soporte ${formatValue(support)} o MACD y volumen dejan de confirmar.` : signalDirection < 0 ? `La lectura pierde validez si el precio supera la resistencia ${formatValue(resistance)} o MACD y volumen dejan de confirmar.` : `No existe una señal direccional válida hasta que el precio confirme soporte o resistencia y coincidan tendencia, volumen y MACD.`;

  return { trend, rsi, bollinger, volume, macd, support, resistance, volatility, confidence, reason, invalidation, stop, target, risk, updatedAt: response.updatedAt ?? new Date().toISOString(), provider: `${quote.priceProvider ?? quote.exchange} · OHLC: ${response.provider ?? "no disponible"}`, resolution: response.resolution ?? "no disponible", availableSignals, alignedSignals };
}

function statusClass(trend: Trend) {
  return trend === "SUBIENDO" ? "bg-emerald-50 text-emerald-700" : trend === "BAJANDO" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700";
}

export function AresBots() {
  const [configurations, setConfigurations] = useState<BotConfigurationState>(() => botConfigurationRepository.load());
  const [mode, setMode] = useState<BotMode>("corto");
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulated, setSimulated] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(true);
  const helpRef = useRef<HTMLElement>(null);
  const current = configurations[mode];
  const asset = assets.find((item) => item.id === current.assetId) ?? assets[0];

  useEffect(() => { setAnalysis(null); setQuote(null); setSimulated(null); }, [mode, current.assetId, current.period]);

  const updateCurrent = (patch: Partial<typeof current>) => setConfigurations((state) => ({ ...state, [mode]: { ...state[mode], ...patch } }));
  const horizon = useMemo(() => current.period === "30 minutos" || current.period === "1 hora" ? 0 : current.period === "4 horas" ? 1 : current.period === "1 día" ? 2 : 3, [current.period]);

  const analyze = async () => {
    setLoading(true); setSimulated(null);
    try {
      const quoteUrl = new URL("/api/markets", window.location.origin); quoteUrl.searchParams.set("market", asset.market);
      const quoteRequest = await fetch(quoteUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
      const quoteData = await quoteRequest.json() as QuoteResponse;
      const selectedQuote = quoteData.items?.find((item) => item.ticker.toLowerCase() === asset.ticker.toLowerCase() || item.symbol.toLowerCase() === asset.ticker.toLowerCase());
      if (!selectedQuote) throw new Error(quoteData.error || `No hay cotización disponible para ${asset.label}`);
      setQuote(selectedQuote);

      const candleUrl = new URL("/api/candles", window.location.origin);
      candleUrl.searchParams.set("market", asset.market); candleUrl.searchParams.set("symbol", selectedQuote.chartSymbol);
      candleUrl.searchParams.set("ticker", selectedQuote.ticker); candleUrl.searchParams.set("horizon", String(horizon));
      const candleRequest = await fetch(candleUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
      const candleData = await candleRequest.json() as CandleResponse;
      if (!candleData.candles?.length) throw new Error(candleData.error || "El proveedor OHLC no devolvió velas suficientes");
      const result = analyzeConfluence(candleData.candles, selectedQuote, candleData, current.risk);
      setAnalysis(result); toast.success(`Análisis completado · ${result.alignedSignals}/${result.availableSignals} señales alineadas`);
    } catch (error) {
      setAnalysis(null); toast.error(error instanceof Error ? error.message : "No se pudo completar el análisis");
    } finally { setLoading(false); }
  };

  const save = () => {
    const next = { ...configurations, [mode]: { ...current, savedAt: new Date().toISOString() } };
    setConfigurations(next); botConfigurationRepository.save(next); toast.success(`${botModes.find((item) => item.id === mode)?.title} guardado en este dispositivo`);
  };
  const reset = () => {
    const defaults = botConfigurationRepository.reset(); setConfigurations(defaults); setQuote(null); setAnalysis(null); setSimulated(null); toast.success("Configuraciones reiniciadas");
  };
  const simulate = () => {
    if (!analysis || !quote) { toast.warning("Pulsa ANALIZAR antes de simular."); return; }
    const distance = analysis.target !== null ? Math.abs(analysis.target - quote.price) / quote.price * 100 : 0;
    const stopDistance = analysis.stop !== null ? Math.abs(analysis.stop - quote.price) / quote.price * 100 : 0;
    setSimulated(`Escenario educativo: objetivo orientativo ${distance.toFixed(2)}% y stop orientativo ${stopDistance.toFixed(2)}%. No se ha enviado ninguna orden ni se ha utilizado dinero real.`);
  };

  const metrics = analysis ? [
    ["RSI", analysis.rsi?.toFixed(1) ?? "—"], ["Bollinger", analysis.bollinger], ["Volumen", analysis.volume],
    ["MACD", analysis.macd], ["Soporte", formatValue(analysis.support, quote?.currency)], ["Resistencia", formatValue(analysis.resistance, quote?.currency)],
    ["Volatilidad", analysis.volatility === null ? "—" : `${analysis.volatility.toFixed(1)}%`], ["Riesgo", analysis.risk],
  ] : [];

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[30px] bg-[#102d4f] p-6 text-white shadow-[0_24px_60px_rgba(16,45,79,.22)] sm:p-9">
      <div className="absolute -right-20 -top-20 size-72 rounded-full border-[44px] border-cyan-300/10"/>
      <div className="absolute bottom-7 right-10 hidden opacity-50 lg:block"><Activity className="size-40 text-blue-400" strokeWidth={.45}/></div>
      <div className="relative max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-cyan-100"><Bot className="size-4"/>Módulo de vigilancia</div><h1 className="mt-4 text-4xl font-black tracking-[-.05em] sm:text-6xl">🤖 BOTS ARES</h1><p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-blue-100 sm:text-base">Configura, analiza y simula señales por confluencia. ARES vigila y explica: nunca compra, vende ni custodia dinero.</p><div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider"><span className="rounded-full bg-emerald-400/15 px-3 py-2 text-emerald-200">Sin apalancamiento</span><span className="rounded-full bg-blue-400/15 px-3 py-2 text-blue-100">Sin margen</span><span className="rounded-full bg-violet-400/15 px-3 py-2 text-violet-100">Sin órdenes reales</span></div></div>
    </section>

    <section className="grid gap-3 lg:grid-cols-3" aria-label="Modos de bot">{botModes.map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={`rounded-[24px] border p-5 text-left transition duration-300 ${mode === item.id ? "border-blue-400 bg-blue-50 shadow-[0_14px_35px_rgba(37,99,235,.12)]" : "border-slate-200 bg-white hover:-translate-y-1 hover:border-blue-200"}`}><div className="flex items-center justify-between"><span className={`flex size-11 items-center justify-center rounded-2xl ${item.color === "blue" ? "bg-blue-600" : item.color === "violet" ? "bg-violet-600" : "bg-emerald-600"} text-white`}><Bot className="size-5"/></span>{mode === item.id && <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[9px] font-black text-white">ACTIVO</span>}</div><h2 className="mt-4 text-lg font-black text-slate-950">{item.title}</h2><p className="mt-1 text-xs font-extrabold uppercase tracking-wider text-blue-600">Periodo principal · {item.period}</p><p className="mt-2 text-sm font-semibold text-slate-500">{item.text}</p></button>)}</section>

    <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <aside className={`rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${configOpen ? "block" : "hidden xl:block"}`}>
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">Controles del usuario</p><h2 className="mt-1 text-xl font-black">Configurar bot</h2></div><Settings2 className="size-6 text-blue-500"/></div>
        <div className="mt-5 space-y-4"><label className="block text-xs font-extrabold text-slate-600">ACTIVO SELECCIONADO<select value={current.assetId} onChange={(event) => updateCurrent({ assetId: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400">{assets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-xs font-extrabold text-slate-600">PERIODO<select value={current.period} onChange={(event) => updateCurrent({ period: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400">{periods.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-xs font-extrabold text-slate-600">OBJETIVO<select value={current.objective} onChange={(event) => updateCurrent({ objective: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400">{objectives.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-xs font-extrabold text-slate-600">NIVEL DE RIESGO<div className="mt-2 grid grid-cols-3 gap-2">{risks.map((item) => <button key={item} onClick={() => updateCurrent({ risk: item })} className={`rounded-xl px-2 py-2.5 text-[10px] font-black ${current.risk === item ? item === "BAJO" ? "bg-emerald-600 text-white" : item === "MEDIO" ? "bg-amber-500 text-white" : "bg-rose-600 text-white" : "bg-slate-100 text-slate-500"}`}>{item}</button>)}</div></label></div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-600"><b className="text-slate-900">Objetivo actual:</b> {current.objective}<br/><span className="text-[10px] text-slate-400">{current.savedAt ? `Guardado: ${new Date(current.savedAt).toLocaleString("es-ES")}` : "Configuración todavía no guardada"}</span></div>
      </aside>

      <div className="space-y-4">
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">Panel de señal</p><h2 className="mt-1 text-2xl font-black tracking-tight">{asset.label}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Periodo solicitado: {current.period} · resolución real: {analysis?.resolution ?? "pendiente de análisis"}</p></div><div className="sm:text-right"><p className="text-[10px] font-black uppercase text-slate-400">Precio actual</p><p className="mt-1 text-2xl font-black">{quote ? formatValue(quote.price, quote.currency) : "—"}</p><p className="text-[10px] font-semibold text-slate-400">{quote?.priceProvider ?? "Proveedor pendiente"}</p></div></div>
          {analysis ? <><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]"><div className={`rounded-[22px] p-5 ${analysis.trend === "SUBIENDO" ? "bg-emerald-50" : analysis.trend === "BAJANDO" ? "bg-rose-50" : "bg-slate-100"}`}><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tendencia detectada</p><div className="mt-2 flex items-center gap-3">{analysis.trend === "SUBIENDO" ? <TrendingUp className="size-8 text-emerald-600"/> : analysis.trend === "BAJANDO" ? <TrendingDown className="size-8 text-rose-600"/> : <Activity className="size-8 text-slate-500"/>}<span className={`rounded-full px-3 py-1.5 text-sm font-black ${statusClass(analysis.trend)}`}>{analysis.trend}</span></div></div><div className="rounded-[22px] bg-[#173b65] p-5 text-white"><p className="text-[10px] font-black uppercase tracking-wider text-blue-200">Confianza</p><p className="mt-2 text-3xl font-black">{analysis.confidence}<span className="text-base text-blue-200">/100</span></p><Progress value={analysis.confidence} className="mt-3 h-2 bg-blue-950"/></div></div><div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-extrabold text-slate-800">{value}</p></div>)}</div><div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-[10px] font-black uppercase text-blue-700">Motivo claro de la señal</p><p className="mt-2 text-xs font-semibold leading-5 text-blue-950">{analysis.reason}</p></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-[10px] font-black uppercase text-amber-700">Qué invalidaría la señal</p><p className="mt-2 text-xs font-semibold leading-5 text-amber-950">{analysis.invalidation}</p></div></div><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p className="text-[9px] font-black uppercase text-rose-600">Stop orientativo</p><p className="mt-1 text-lg font-black text-rose-950">{formatValue(analysis.stop, quote?.currency)}</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-[9px] font-black uppercase text-emerald-600">Objetivo orientativo</p><p className="mt-1 text-lg font-black text-emerald-950">{formatValue(analysis.target, quote?.currency)}</p></div></div><div className="mt-4 flex flex-col gap-1 rounded-2xl border border-slate-200 p-4 text-[10px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>PROVEEDOR REAL: <b className="text-slate-800">{analysis.provider}</b></span><span><Clock3 className="mr-1 inline size-3"/>Última actualización: {new Date(analysis.updatedAt).toLocaleString("es-ES")}</span></div></> : <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center"><span className="flex size-16 items-center justify-center rounded-[22px] bg-blue-100 text-blue-600"><BarChart3 className="size-8"/></span><h3 className="mt-4 text-lg font-black">Listo para analizar</h3><p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">ARES consultará cotización e histórico, calculará la confluencia y limitará la confianza si faltan indicadores.</p></div>}
          {simulated && <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-xs font-semibold leading-5 text-violet-950"><Play className="mb-2 size-5 text-violet-600"/>{simulated}</div>}
        </section>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Acciones del bot"><Button onClick={analyze} disabled={loading} className="h-auto min-h-12 whitespace-normal rounded-xl bg-blue-600 px-3 py-3 text-xs font-black hover:bg-blue-700">{loading ? <LoaderCircle className="mr-2 size-4 shrink-0 animate-spin"/> : <Zap className="mr-2 size-4 shrink-0"/>}ANALIZAR</Button><Button onClick={() => setConfigOpen((value) => !value)} variant="outline" className="h-auto min-h-12 whitespace-normal rounded-xl border-slate-200 px-3 py-3 text-xs font-black"><Settings2 className="mr-2 size-4 shrink-0"/>CONFIGURAR BOT</Button><Button onClick={simulate} variant="outline" className="h-auto min-h-12 whitespace-normal rounded-xl border-violet-200 bg-violet-50 px-3 py-3 text-xs font-black text-violet-700"><Play className="mr-2 size-4 shrink-0"/>SIMULAR</Button><Button onClick={save} variant="outline" className="h-auto min-h-12 whitespace-normal rounded-xl border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-black leading-4 text-emerald-700"><Save className="mr-2 size-4 shrink-0"/>GUARDAR CONFIGURACIÓN</Button><Button onClick={reset} variant="outline" className="h-auto min-h-12 whitespace-normal rounded-xl border-slate-200 px-3 py-3 text-xs font-black"><RefreshCw className="mr-2 size-4 shrink-0"/>REINICIAR</Button><Button onClick={() => helpRef.current?.scrollIntoView({ behavior: "smooth" })} variant="outline" className="h-auto min-h-12 whitespace-normal rounded-xl border-amber-200 bg-amber-50 px-3 py-3 text-xs font-black text-amber-800"><CircleHelp className="mr-2 size-4 shrink-0"/>AYUDA</Button></section>

    <div className="rounded-[22px] border border-rose-100 bg-rose-50 p-5 text-center"><AlertTriangle className="mx-auto size-6 text-rose-600"/><p className="mt-2 text-sm font-black text-rose-950">Una señal de confianza alta no garantiza beneficios.</p><p className="mt-1 text-xs font-semibold text-rose-700">Las señales son orientativas y pueden fallar incluso cuando varios indicadores coinciden.</p></div>

    <section ref={helpRef} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Sparkles className="size-6"/></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">Guía sencilla</p><h2 className="mt-1 text-2xl font-black tracking-tight">ARES TE AYUDA A CONFIGURAR TU BOT</h2><p className="mt-2 text-sm font-semibold text-slate-500">Sigue estos pasos. No necesitas conocimientos técnicos.</p></div></div><div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[
      ["1", "Elige el bot", "Corto para intradía, Medio para varios días o Tendencia para movimientos largos."],
      ["2", "Selecciona activo y periodo", "Escoge qué quieres vigilar. ARES mostrará la resolución real entregada por el proveedor."],
      ["3", "Define objetivo y riesgo", "Indica qué buscas y cuánto riesgo aceptas. No se usa margen ni apalancamiento."],
      ["4", "Analiza y revisa", "Pulsa ANALIZAR. Lee el motivo, la invalidación, el stop y el objetivo antes de simular."],
    ].map(([number, title, text]) => <article key={number} className="rounded-[20px] bg-slate-50 p-4"><span className="flex size-8 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">{number}</span><h3 className="mt-3 text-sm font-black">{title}</h3><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{text}</p></article>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-blue-50 p-4"><Gauge className="size-5 text-blue-600"/><b className="mt-2 block text-xs text-blue-950">Confianza prudente</b><p className="mt-1 text-[11px] font-semibold leading-5 text-blue-700">Sin volumen o sin cinco señales alineadas, ARES no permite confianza alta.</p></div><div className="rounded-2xl bg-emerald-50 p-4"><ShieldCheck className="size-5 text-emerald-600"/><b className="mt-2 block text-xs text-emerald-950">Guardado local</b><p className="mt-1 text-[11px] font-semibold leading-5 text-emerald-700">Tu configuración permanece en este navegador y el repositorio está preparado para almacenamiento externo.</p></div><div className="rounded-2xl bg-amber-50 p-4"><Target className="size-5 text-amber-700"/><b className="mt-2 block text-xs text-amber-950">Niveles orientativos</b><p className="mt-1 text-[11px] font-semibold leading-5 text-amber-800">Stop y objetivo sirven para planificar; no son órdenes ni garantías de ejecución.</p></div></div></section>

    <footer className="rounded-[22px] bg-[#173b65] p-5 text-center text-blue-50"><p className="text-xs font-black">ARES configura, vigila y simula. No ejecuta compras o ventas, no custodia dinero y no utiliza apalancamiento ni margen.</p></footer>
  </div>;
}
