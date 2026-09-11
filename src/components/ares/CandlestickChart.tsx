import { useMemo } from "react";
import type { MarketCandle } from "./market-config";

type Props = {
  candles: MarketCandle[];
  showEma: boolean;
  showBollinger: boolean;
  showVolume: boolean;
  showRsi: boolean;
};

function ema(values: number[], period: number) {
  if (values.length < period) return values.map(() => null);
  const alpha = 2 / (period + 1);
  const result: Array<number | null> = values.map(() => null);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = current;
  for (let index = period; index < values.length; index++) {
    current = alpha * values[index] + (1 - alpha) * current;
    result[index] = current;
  }
  return result;
}

function rsi(values: number[], period = 14) {
  return values.map((_, index) => {
    if (index < period) return null;
    let gains = 0, losses = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor++) {
      const change = values[cursor] - values[cursor - 1];
      gains += Math.max(change, 0);
      losses += Math.max(-change, 0);
    }
    if (!losses) return 100;
    const relative = gains / losses;
    return 100 - 100 / (1 + relative);
  });
}

function bollinger(values: number[], period = 20) {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const window = values.slice(index - period + 1, index + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / period;
    const deviation = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period);
    return { upper: mean + 2 * deviation, lower: mean - 2 * deviation };
  });
}

export function CandlestickChart({ candles, showEma, showBollinger, showVolume, showRsi }: Props) {
  const data = useMemo(() => candles.slice(-260), [candles]);
  const computed = useMemo(() => {
    if (data.length < 2) return null;
    const closes = data.map((item) => item.close);
    const bands = bollinger(closes);
    const priceValues = data.flatMap((item, index) => [item.low, item.high, bands[index]?.lower, bands[index]?.upper].filter((value): value is number => value !== undefined));
    const lowest = Math.min(...priceValues);
    const highest = Math.max(...priceValues);
    const padding = Math.max((highest - lowest) * 0.08, highest * 0.002);
    return {
      minimum: lowest - padding,
      maximum: highest + padding,
      ema9: ema(closes, 9),
      ema21: ema(closes, 21),
      bands,
      rsi14: rsi(closes),
      maxVolume: Math.max(1, ...data.map((item) => item.volume ?? 0)),
    };
  }, [data]);

  if (!computed) return <div className="flex h-80 items-center justify-center text-sm font-bold text-slate-400">SIN DATOS OHLC – FUENTE NO DISPONIBLE</div>;

  const width = 1000;
  const priceTop = 18;
  const priceBottom = showRsi ? 258 : 320;
  const volumeHeight = showVolume ? 55 : 0;
  const candleBottom = priceBottom - volumeHeight;
  const rsiTop = 285;
  const rsiBottom = 365;
  const range = computed.maximum - computed.minimum;
  const step = 940 / data.length;
  const bodyWidth = Math.max(1.2, Math.min(9, step * 0.62));
  const x = (index: number) => 45 + step * index + step / 2;
  const y = (value: number) => priceTop + (computed.maximum - value) / range * (candleBottom - priceTop);
  const linePath = (values: Array<number | null>) => {
    let drawing = false;
    return values.flatMap((value, index) => {
      if (value === null) { drawing = false; return []; }
      const command = `${drawing ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
      drawing = true;
      return [command];
    }).join(" ");
  };
  const rsiPath = computed.rsi14.flatMap((value, index) => value === null ? [] : [`${index === 14 ? "M" : "L"}${x(index).toFixed(1)},${(rsiBottom - value / 100 * (rsiBottom - rsiTop)).toFixed(1)}`]).join(" ");
  const upperBand = linePath(computed.bands.map((band) => band?.upper ?? null));
  const lowerBand = linePath(computed.bands.map((band) => band?.lower ?? null));

  return <div className="w-full overflow-x-auto">
    <svg viewBox={`0 0 ${width} 380`} className="w-full min-w-[720px]" role="img" aria-label={`Gráfico con ${data.length} velas OHLC reales`}>
      {[0, .25, .5, .75, 1].map((ratio) => {
        const value = computed.maximum - range * ratio;
        const position = priceTop + (candleBottom - priceTop) * ratio;
        return <g key={ratio}><line x1="40" x2="990" y1={position} y2={position} stroke="#e2e8f0" strokeDasharray="4 5"/><text x="4" y={position + 4} fontSize="10" fill="#64748b">{value.toLocaleString("es-ES", { maximumFractionDigits: 3 })}</text></g>;
      })}
      {showBollinger && data.length >= 20 && <><path d={upperBand} fill="none" stroke="#8b5cf6" strokeWidth="1.4" strokeDasharray="5 4"/><path d={lowerBand} fill="none" stroke="#8b5cf6" strokeWidth="1.4" strokeDasharray="5 4"/></>}
      {data.map((item, index) => {
        const positive = item.close >= item.open;
        const color = positive ? "#059669" : "#e11d48";
        const top = y(Math.max(item.open, item.close));
        const bottom = y(Math.min(item.open, item.close));
        return <g key={`${item.time}-${index}`}>
          <title>{`${new Date(item.time).toLocaleString("es-ES")} · O ${item.open} · H ${item.high} · L ${item.low} · C ${item.close}${item.volume !== null ? ` · Vol ${item.volume}` : ""}`}</title>
          <line x1={x(index)} x2={x(index)} y1={y(item.high)} y2={y(item.low)} stroke={color} strokeWidth="1.4"/>
          <rect x={x(index) - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1.5, bottom - top)} rx="1" fill={color}/>
          {showVolume && item.volume !== null && <rect x={x(index) - bodyWidth / 2} y={priceBottom - item.volume / computed.maxVolume * volumeHeight} width={bodyWidth} height={item.volume / computed.maxVolume * volumeHeight} fill={color} opacity=".22"/>}
        </g>;
      })}
      {showEma && data.length >= 9 && <path d={linePath(computed.ema9)} fill="none" stroke="#2563eb" strokeWidth="2"/>}
      {showEma && data.length >= 21 && <path d={linePath(computed.ema21)} fill="none" stroke="#d97706" strokeWidth="2"/>}
      {showRsi && data.length >= 15 && <g><rect x="40" y={rsiTop} width="950" height={rsiBottom-rsiTop} fill="#f8fafc"/><line x1="40" x2="990" y1={rsiBottom-.7*(rsiBottom-rsiTop)} y2={rsiBottom-.7*(rsiBottom-rsiTop)} stroke="#f59e0b" strokeDasharray="4 4"/><line x1="40" x2="990" y1={rsiBottom-.3*(rsiBottom-rsiTop)} y2={rsiBottom-.3*(rsiBottom-rsiTop)} stroke="#f59e0b" strokeDasharray="4 4"/><text x="5" y={rsiTop+12} fontSize="10" fill="#64748b">RSI 14</text><path d={rsiPath} fill="none" stroke="#7c3aed" strokeWidth="2"/></g>}
      <g transform="translate(60 373)" fontSize="10" fontWeight="700"><text fill="#2563eb">EMA 9</text><text x="55" fill="#d97706">EMA 21</text><text x="120" fill="#8b5cf6">Bollinger 20</text><text x="205" fill="#059669">Vela alcista</text><text x="290" fill="#e11d48">Vela bajista</text></g>
    </svg>
  </div>;
}
