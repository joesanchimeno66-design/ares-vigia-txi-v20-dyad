import { useEffect, useState } from "react";
import { Activity, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getHorizonLabels, type MarketCandle, type MarketId, type MarketQuote } from "./market-config";
import { CandlestickChart } from "./CandlestickChart";

type Props = {
  chart: { quote: MarketQuote; horizon: number; market: MarketId } | null;
  onClose: () => void;
};

type CandleResponse = {
  candles: MarketCandle[];
  provider: string;
  resolution: string;
  error?: string | null;
};

export function MarketChartDialog({ chart, onClose }: Props) {
  const [response, setResponse] = useState<CandleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEma, setShowEma] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(true);

  useEffect(() => {
    if (!chart) { setResponse(null); return; }
    const controller = new AbortController();
    const endpoint = new URL("/api/candles", window.location.origin);
    endpoint.searchParams.set("market", chart.market);
    endpoint.searchParams.set("symbol", chart.quote.chartSymbol);
    endpoint.searchParams.set("ticker", chart.quote.ticker);
    endpoint.searchParams.set("asset", chart.quote.symbol);
    endpoint.searchParams.set("horizon", String(chart.horizon));
    setLoading(true);
    setResponse(null);
    fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal })
      .then(async (request) => {
        if (!request.ok || !request.headers.get("content-type")?.includes("application/json")) throw new Error(`HTTP ${request.status}`);
        return request.json() as Promise<CandleResponse>;
      })
      .then(setResponse)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResponse({ candles: [], provider: "fuentes OHLC no disponibles", resolution: "no disponible", error: error instanceof Error ? error.message : "error de conexión" });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [chart]);

  const candles = response?.candles ?? [];
  const indicatorButton = (label: string, active: boolean, enabled: boolean, toggle: () => void) => (
    <Button type="button" size="sm" variant="outline" disabled={!enabled} onClick={toggle} className={`rounded-xl ${active && enabled ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200"}`}>
      {label}
    </Button>
  );

  return <Dialog open={!!chart} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-5xl rounded-[24px] border-slate-200 p-0">
      <DialogHeader className="border-b border-slate-100 p-5">
        <DialogTitle className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Activity className="size-5"/></span>{chart?.quote.symbol} · {chart?.quote.name}</DialogTitle>
        <DialogDescription>{chart ? getHorizonLabels(chart.market)[chart.horizon] : ""} · {loading ? "Consultando OHLC real…" : response ? `${response.provider} · ${response.resolution} · ${candles.length} velas reales` : "Preparando histórico…"}</DialogDescription>
      </DialogHeader>
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {indicatorButton("EMA 9/21", showEma, candles.length >= 9, () => setShowEma((value) => !value))}
          {indicatorButton("Bollinger 20", showBollinger, candles.length >= 20, () => setShowBollinger((value) => !value))}
          {indicatorButton("RSI 14", showRsi, candles.length >= 15, () => setShowRsi((value) => !value))}
          {indicatorButton("Volumen", showVolume, candles.some((item) => item.volume !== null), () => setShowVolume((value) => !value))}
        </div>
        {loading ? <div className="flex h-80 items-center justify-center gap-2 text-sm font-bold text-blue-600"><LoaderCircle className="size-5 animate-spin"/>Cargando velas OHLC…</div> : response?.error || candles.length < 2 ? <div className="flex h-80 items-center justify-center rounded-2xl bg-slate-50 px-6 text-center text-sm font-bold text-slate-500">{response?.error ?? "SIN DATOS OHLC – FUENTE NO DISPONIBLE"}</div> : <CandlestickChart candles={candles} showEma={showEma} showBollinger={showBollinger} showVolume={showVolume} showRsi={showRsi}/>} 
      </div>
    </DialogContent>
  </Dialog>;
}
