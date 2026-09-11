import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, BrainCircuit,
  BriefcaseBusiness, ChevronRight, FileUp, Plus, Radar, Star, Trash2, WalletCards,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MarketId, MarketQuote, SectionId } from "./market-config";
import {
  portfolioRepository, sampleCurrentPrices,
  type AlertKind, type OperationType, type PortfolioAlert, type PortfolioCategory, type PortfolioOperation, type PortfolioState,
} from "./portfolio-storage";

type Props = {
  quotes: Record<MarketId, MarketQuote[]>;
  watchlist: string[];
  onNavigate: (section: SectionId) => void;
  onToggleWatch: (ticker: string) => void;
  incomingAsset: MarketQuote | null;
  onAssetConsumed: () => void;
};

type Holding = {
  ticker: string; name: string; category: PortfolioCategory; quantity: number; averagePrice: number;
  currentPrice: number; value: number; cost: number; pnl: number; pnlPercent: number; weight: number;
};

const categories: PortfolioCategory[] = ["Acciones", "Criptomonedas", "ETFs", "Índices", "Materias Primas", "Forex"];
const categoryColors: Record<PortfolioCategory, string> = {
  Acciones: "#2563eb", Criptomonedas: "#7c3aed", ETFs: "#0891b2", Índices: "#059669", "Materias Primas": "#d97706", Forex: "#e11d48",
};
const benchmarks = ["S&P 500", "Euro Stoxx 50", "IBEX 35", "MSCI World"];
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 4 });
const initialDraft = { ticker: "", name: "", category: "Acciones" as PortfolioCategory, type: "COMPRA" as OperationType, quantity: "", price: "", date: new Date().toISOString().slice(0, 10) };

function buildHoldings(operations: PortfolioOperation[], prices: Map<string, number>): Holding[] {
  const grouped = new Map<string, { ticker: string; name: string; category: PortfolioCategory; quantity: number; cost: number }>();
  for (const operation of [...operations].sort((a, b) => a.date < b.date ? -1 : 1)) {
    const key = operation.ticker.toUpperCase();
    const current = grouped.get(key) ?? { ticker: key, name: operation.name, category: operation.category, quantity: 0, cost: 0 };
    if (operation.type === "COMPRA") {
      current.cost += operation.quantity * operation.price;
      current.quantity += operation.quantity;
    } else if (current.quantity > 0) {
      const sold = Math.min(operation.quantity, current.quantity);
      current.cost -= sold * (current.cost / current.quantity);
      current.quantity -= sold;
    }
    grouped.set(key, current);
  }
  const active = [...grouped.values()].filter((item) => item.quantity > 0.0000001);
  const values = active.map((item) => {
    const averagePrice = item.cost / item.quantity;
    const currentPrice = prices.get(item.ticker) ?? sampleCurrentPrices[item.ticker] ?? averagePrice;
    const value = item.quantity * currentPrice;
    const pnl = value - item.cost;
    return { ...item, averagePrice, currentPrice, value, pnl, pnlPercent: item.cost ? pnl / item.cost * 100 : 0, weight: 0 };
  });
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return values.map((item) => ({ ...item, weight: total ? item.value / total * 100 : 0 })).sort((a, b) => b.value - a.value);
}

function Pnl({ value, percent, compact = false }: { value: number; percent: number; compact?: boolean }) {
  const positive = value >= 0;
  return <span className={`inline-flex items-center gap-1 font-extrabold ${positive ? "text-emerald-700" : "text-rose-700"}`}>
    {positive ? <ArrowUpRight className="size-3.5"/> : <ArrowDownRight className="size-3.5"/>}
    {compact ? `${positive ? "+" : ""}${percent.toFixed(2)}%` : `${positive ? "+" : ""}${euro.format(value)} · ${positive ? "+" : ""}${percent.toFixed(2)}%`}
  </span>;
}

function categoryForQuote(quote: MarketQuote, quotes: Record<MarketId, MarketQuote[]>): PortfolioCategory {
  const market = (Object.entries(quotes) as [MarketId, MarketQuote[]][]).find(([, items]) => items.some((item) => item.ticker === quote.ticker))?.[0];
  if (market === "cripto") return "Criptomonedas";
  if (market === "etfs" || market === "fondos") return "ETFs";
  if (market === "indices") return "Índices";
  if (market === "materias") return "Materias Primas";
  if (market === "forex") return "Forex";
  return "Acciones";
}

export function Portfolio({ quotes, watchlist, onNavigate, onToggleWatch, incomingAsset, onAssetConsumed }: Props) {
  const [state, setState] = useState<PortfolioState>(() => portfolioRepository.load());
  const [operationOpen, setOperationOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [alertDraft, setAlertDraft] = useState<{ ticker: string; kind: AlertKind; threshold: string }>({ ticker: "", kind: "beneficio", threshold: "10" });
  const fileRef = useRef<HTMLInputElement>(null);

  const updateState = (next: PortfolioState) => { setState(next); portfolioRepository.save(next); };
  useEffect(() => {
    if (!incomingAsset) return;
    setDraft({ ...initialDraft, ticker: incomingAsset.ticker, name: incomingAsset.name, category: categoryForQuote(incomingAsset, quotes), price: String(incomingAsset.price) });
    setOperationOpen(true);
    onAssetConsumed();
  }, [incomingAsset, onAssetConsumed, quotes]);
  const livePrices = useMemo(() => {
    const map = new Map<string, number>();
    for (const quote of Object.values(quotes).flat()) { map.set(quote.ticker.toUpperCase(), quote.price); map.set(quote.symbol.toUpperCase(), quote.price); }
    return map;
  }, [quotes]);
  const holdings = useMemo(() => buildHoldings(state.operations, livePrices), [state.operations, livePrices]);
  const totalValue = holdings.reduce((sum, item) => sum + item.value, 0);
  const totalCost = holdings.reduce((sum, item) => sum + item.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost ? totalPnl / totalCost * 100 : 0;
  const distribution = categories.map((category) => ({ name: category, value: holdings.filter((item) => item.category === category).reduce((sum, item) => sum + item.value, 0), color: categoryColors[category] })).filter((item) => item.value > 0);
  const scale = totalValue / (state.snapshots.at(-1)?.value || totalValue || 1);
  const chartData = state.snapshots.map((item, index, all) => {
    const portfolio = item.value * scale;
    const baseline = all[0]?.benchmark || 100;
    const profile = state.benchmark === "S&P 500" ? { drift: .00042, wave: .012 } : state.benchmark === "MSCI World" ? { drift: .00034, wave: .01 } : state.benchmark === "Euro Stoxx 50" ? { drift: .00028, wave: .017 } : { drift: .00022, wave: .021 };
    const normalizedIndex = baseline * (1 + index * profile.drift + Math.sin(index / 19) * profile.wave);
    const benchmark = (all[0]?.value ?? item.value) * scale * normalizedIndex / baseline;
    return { date: item.date, portfolio, benchmark };
  });
  const returnForDays = (days: number) => {
    const last = chartData.at(-1)?.portfolio;
    const previous = chartData.at(-(Math.min(days, chartData.length - 1) + 1))?.portfolio;
    return last !== undefined && previous ? (last - previous) / previous * 100 : 0;
  };
  const returns: Array<[string, number]> = [
    ["Diaria", returnForDays(1)], ["Semanal", returnForDays(7)], ["Mensual", returnForDays(30)], ["Trimestral", returnForDays(90)], ["Semestral", returnForDays(182)], ["Anual", returnForDays(365)],
  ];

  const saveOperation = () => {
    const quantity = Number(draft.quantity), price = Number(draft.price);
    if (!draft.ticker.trim() || !draft.name.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) { toast.error("Completa símbolo, nombre, cantidad y precio válidos."); return; }
    const operation: PortfolioOperation = { id: crypto.randomUUID(), ticker: draft.ticker.trim().toUpperCase(), name: draft.name.trim(), category: draft.category, type: draft.type, quantity, price, date: draft.date };
    updateState({ ...state, operations: [operation, ...state.operations] });
    setDraft(initialDraft); setOperationOpen(false); toast.success("Operación de seguimiento registrada");
  };
  const removeOperation = (id: string) => { updateState({ ...state, operations: state.operations.filter((item) => item.id !== id) }); toast.success("Operación eliminada"); };
  const saveAlert = () => {
    const threshold = Number(alertDraft.threshold);
    if (!alertDraft.ticker.trim() || !Number.isFinite(threshold)) { toast.error("Introduce un activo y un umbral válido."); return; }
    const alert: PortfolioAlert = { id: crypto.randomUUID(), ticker: alertDraft.ticker.trim().toUpperCase(), kind: alertDraft.kind, threshold, active: true };
    updateState({ ...state, alerts: [alert, ...state.alerts] }); setAlertOpen(false); setAlertDraft({ ticker: "", kind: "beneficio", threshold: "10" }); toast.success("Alerta de análisis creada");
  };
  const importCsv = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = String(reader.result ?? "").split(/\r?\n/).filter(Boolean);
      const imported = rows.slice(1).flatMap((row): PortfolioOperation[] => {
        const [ticker, name, category, type, quantityRaw, priceRaw, date] = row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
        const quantity = Number(quantityRaw?.replace(",", ".")), price = Number(priceRaw?.replace(",", "."));
        if (!ticker || !name || !categories.includes(category as PortfolioCategory) || !["COMPRA", "VENTA"].includes(type) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) return [];
        return [{ id: crypto.randomUUID(), ticker: ticker.toUpperCase(), name, category: category as PortfolioCategory, type: type as OperationType, quantity, price, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10) }];
      });
      if (!imported.length) { toast.error("CSV sin operaciones válidas. Usa: ticker,nombre,categoría,tipo,cantidad,precio,fecha"); return; }
      updateState({ ...state, operations: [...imported, ...state.operations] }); toast.success(`${imported.length} operaciones importadas`);
    };
    reader.readAsText(file);
  };
  const prepareWatch = (ticker: string) => {
    const quote = Object.values(quotes).flat().find((item) => item.ticker === ticker || item.symbol === ticker);
    setDraft({ ...initialDraft, ticker, name: quote?.name ?? ticker, price: quote ? String(quote.price) : "" }); setOperationOpen(true);
  };

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-blue-600"><BriefcaseBusiness className="size-4"/>ARES Portfolio</div><h1 className="mt-1 text-3xl font-black tracking-[-.04em] text-slate-950">Cartera bajo control.</h1><p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Seguimiento y análisis informativo. No custodia fondos, no conecta con brókeres y no ejecuta operaciones.</p></div>
      <div className="flex flex-wrap gap-2"><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { importCsv(event.target.files?.[0]); event.target.value = ""; }}/><Button variant="outline" onClick={() => fileRef.current?.click()} className="h-11 rounded-xl border-slate-200 font-bold"><FileUp className="mr-2 size-4"/>Importar CSV</Button><Button onClick={() => setOperationOpen(true)} className="h-11 rounded-xl bg-blue-600 font-bold hover:bg-blue-700"><Plus className="mr-2 size-4"/>Nueva operación</Button></div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="relative overflow-hidden rounded-[24px] bg-[#173b65] p-5 text-white shadow-[0_16px_38px_rgba(23,59,101,.2)]"><WalletCards className="absolute -bottom-3 -right-3 size-24 text-white/5"/><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-200">Valor total</p><p className="mt-3 text-3xl font-black tracking-tight">{euro.format(totalValue)}</p><p className="mt-2 text-xs font-semibold text-blue-100">{holdings.length} posiciones activas · cotizaciones cargadas o muestra demostrativa</p></div>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Beneficio / Pérdida</p><p className={`mt-3 text-2xl font-black ${totalPnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{totalPnl >= 0 ? "+" : ""}{euro.format(totalPnl)}</p><div className="mt-2 text-xs"><Pnl value={totalPnl} percent={totalPnlPercent} compact/></div></div>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Capital analizado</p><p className="mt-3 text-2xl font-black text-slate-900">{euro.format(totalCost)}</p><p className="mt-2 text-xs font-semibold text-slate-500">Precio medio ponderado por activo</p></div>
      <div className="rounded-[24px] border border-violet-100 bg-violet-50 p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">ARES IA · síntesis</p><p className="mt-3 text-sm font-extrabold leading-5 text-violet-950">{totalPnl >= 0 ? "Cartera en beneficio, con diversificación activa." : "Cartera bajo coste; revisa concentración y tendencia."}</p><button onClick={() => onNavigate("ia")} className="mt-3 inline-flex items-center text-xs font-black text-violet-700">Abrir análisis <ChevronRight className="size-3.5"/></button></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.55fr_.75fr]">
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-900">Evolución de la cartera</h2><p className="text-xs font-semibold text-slate-500">12 meses · comparación normalizada · muestra demostrativa</p></div><select value={state.benchmark} onChange={(event) => updateState({ ...state, benchmark: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none">{benchmarks.map((item) => <option key={item}>{item}</option>)}</select></div><div className="h-[290px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 5"/><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} minTickGap={40}/><YAxis hide domain={["auto", "auto"]}/><Tooltip formatter={(value: number) => euro.format(value)} labelFormatter={(value) => new Date(value).toLocaleDateString("es-ES")}/><Area type="monotone" dataKey="portfolio" name="Portfolio" stroke="#2563eb" strokeWidth={3} fill="#dbeafe" fillOpacity={.72}/><Line type="monotone" dataKey="benchmark" name={state.benchmark} stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 4" dot={false}/></AreaChart></ResponsiveContainer></div></div>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Distribución</h2><p className="text-xs font-semibold text-slate-500">Por clase de activo</p><div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3}>{distribution.map((item) => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={(value: number) => euro.format(value)}/></PieChart></ResponsiveContainer></div><div className="space-y-2">{distribution.map((item) => <div key={item.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 font-bold text-slate-600"><i className="size-2.5 rounded-full" style={{ backgroundColor: item.color }}/>{item.name}</span><b>{totalValue ? (item.value / totalValue * 100).toFixed(1) : "0"}%</b></div>)}</div></div>
    </section>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{returns.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-base font-black ${Number(value) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{Number(value) >= 0 ? "+" : ""}{Number(value).toFixed(2)}%</p></div>)}</section>

    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-black">Posiciones</h2><p className="text-xs font-semibold text-slate-500">Precio medio, precio actual, peso y resultado</p></div><button onClick={() => onNavigate("acciones")} className="inline-flex items-center text-xs font-black text-blue-600"><Radar className="mr-1.5 size-4"/>Radar</button></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">{["Activo", "Categoría", "Cantidad", "Precio medio", "Precio actual", "Valor", "Peso", "Beneficio / Pérdida", "Favorito"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{holdings.map((item) => <tr key={item.ticker} className="hover:bg-blue-50/30"><td className="px-4 py-3"><b className="block text-sm">{item.ticker}</b><span className="text-[10px] font-semibold text-slate-500">{item.name}</span></td><td className="px-4 py-3 text-xs font-bold text-slate-600">{item.category}</td><td className="px-4 py-3 text-xs font-bold">{number.format(item.quantity)}</td><td className="px-4 py-3 text-xs font-bold">{euro.format(item.averagePrice)}</td><td className="px-4 py-3 text-xs font-black">{euro.format(item.currentPrice)}</td><td className="px-4 py-3 text-xs font-black">{euro.format(item.value)}</td><td className="px-4 py-3 text-xs font-black">{item.weight.toFixed(1)}%</td><td className="px-4 py-3 text-xs"><Pnl value={item.pnl} percent={item.pnlPercent}/></td><td className="px-4 py-3"><button onClick={() => onToggleWatch(item.ticker)} className={`rounded-xl p-2 ${watchlist.includes(item.ticker) ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"}`}><Star className="size-4" fill={watchlist.includes(item.ticker) ? "currentColor" : "none"}/></button></td></tr>)}</tbody></table></div></section>

    <section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-black">Historial de operaciones</h2><p className="text-xs font-semibold text-slate-500">Registro informativo, sin ejecución real</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700">{state.operations.length} movimientos</span></div><div className="max-h-80 overflow-auto"><table className="w-full min-w-[650px] text-left"><thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr>{["Fecha", "Activo", "Tipo", "Cantidad", "Precio", "Total", ""].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{state.operations.map((item) => <tr key={item.id}><td className="px-4 py-3 text-xs font-semibold text-slate-500">{new Date(item.date).toLocaleDateString("es-ES")}</td><td className="px-4 py-3"><b className="text-xs">{item.ticker}</b><span className="ml-2 text-[10px] text-slate-400">{item.name}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.type === "COMPRA" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{item.type}</span></td><td className="px-4 py-3 text-xs font-bold">{number.format(item.quantity)}</td><td className="px-4 py-3 text-xs font-bold">{euro.format(item.price)}</td><td className="px-4 py-3 text-xs font-black">{euro.format(item.quantity * item.price)}</td><td className="px-4 py-3"><button onClick={() => removeOperation(item.id)} className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-3.5"/></button></td></tr>)}</tbody></table></div></div>
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-black">Alertas personalizadas</h2><p className="text-xs font-semibold text-slate-500">Beneficio, pérdida, volumen y tendencia</p></div><button onClick={() => setAlertOpen(true)} className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Plus className="size-4"/></button></div><div className="mt-4 space-y-2">{state.alerts.map((alert) => <div key={alert.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><button type="button" onClick={() => updateState({ ...state, alerts: state.alerts.map((item) => item.id === alert.id ? { ...item, active: !item.active } : item) })} className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${alert.active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`} aria-label={alert.active ? "Pausar alerta" : "Activar alerta"}><BellRing className="size-4"/></button><div className="min-w-0 flex-1"><b className="block text-xs">{alert.ticker} · <span className="capitalize">{alert.kind}</span></b><span className="text-[10px] font-semibold text-slate-500">Umbral {alert.threshold}{alert.kind === "volumen" ? "" : "%"}</span></div><button onClick={() => updateState({ ...state, alerts: state.alerts.filter((item) => item.id !== alert.id) })} className="text-slate-300 hover:text-rose-600"><Trash2 className="size-3.5"/></button></div>)}</div><Button variant="outline" onClick={() => setAlertOpen(true)} className="mt-4 w-full rounded-xl border-slate-200 font-bold"><AlertTriangle className="mr-2 size-4"/>Configurar alerta</Button></div>
    </section>

    <section className="grid gap-3 md:grid-cols-3"><button onClick={() => onNavigate("acciones")} className="flex items-center gap-3 rounded-[20px] border border-blue-100 bg-blue-50 p-4 text-left"><Radar className="size-5 text-blue-600"/><span><b className="block text-sm text-blue-950">Radar conectado</b><span className="text-xs font-semibold text-blue-700">Contrasta posiciones con el mercado.</span></span></button><button onClick={() => onNavigate("indices")} className="flex items-center gap-3 rounded-[20px] border border-emerald-100 bg-emerald-50 p-4 text-left"><Activity className="size-5 text-emerald-600"/><span><b className="block text-sm text-emerald-950">Lanzaderas</b><span className="text-xs font-semibold text-emerald-700">Revisa impulso y contexto.</span></span></button><button onClick={() => onNavigate("ia")} className="flex items-center gap-3 rounded-[20px] border border-violet-100 bg-violet-50 p-4 text-left"><BrainCircuit className="size-5 text-violet-600"/><span><b className="block text-sm text-violet-950">ARES IA</b><span className="text-xs font-semibold text-violet-700">Interpreta la cartera cargada.</span></span></button></section>

    {watchlist.length > 0 && <section className="rounded-[24px] border border-amber-100 bg-amber-50 p-5"><div className="flex items-center gap-2"><Star className="size-4 text-amber-600"/><h2 className="font-black text-amber-950">Desde tu Watchlist</h2></div><div className="mt-3 flex flex-wrap gap-2">{watchlist.map((ticker) => <button key={ticker} onClick={() => prepareWatch(ticker)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-800 shadow-sm">+ {ticker}</button>)}</div></section>}

    <Dialog open={operationOpen} onOpenChange={setOperationOpen}><DialogContent className="max-w-xl rounded-[24px]"><DialogHeader><DialogTitle>Nueva operación de seguimiento</DialogTitle><DialogDescription>Registra una compra o venta histórica. ARES no envía órdenes ni mueve dinero.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Símbolo<Input value={draft.ticker} onChange={(event) => setDraft({ ...draft, ticker: event.target.value })} className="mt-2 rounded-xl" placeholder="AAPL"/></label><label className="text-xs font-bold text-slate-600">Nombre<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-2 rounded-xl" placeholder="Apple"/></label><label className="text-xs font-bold text-slate-600">Categoría<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as PortfolioCategory })} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3">{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Tipo<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as OperationType })} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3"><option>COMPRA</option><option>VENTA</option></select></label><label className="text-xs font-bold text-slate-600">Cantidad<Input type="number" min="0" step="any" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} className="mt-2 rounded-xl"/></label><label className="text-xs font-bold text-slate-600">Precio unitario<Input type="number" min="0" step="any" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="mt-2 rounded-xl"/></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Fecha<Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="mt-2 rounded-xl"/></label></div><Button onClick={saveOperation} className="mt-2 rounded-xl bg-blue-600 font-bold">Guardar operación informativa</Button></DialogContent></Dialog>

    <Dialog open={alertOpen} onOpenChange={setAlertOpen}><DialogContent className="max-w-md rounded-[24px]"><DialogHeader><DialogTitle>Crear alerta personalizada</DialogTitle><DialogDescription>La alerta ayuda a vigilar; nunca ejecuta una operación.</DialogDescription></DialogHeader><label className="text-xs font-bold text-slate-600">Activo<Input value={alertDraft.ticker} onChange={(event) => setAlertDraft({ ...alertDraft, ticker: event.target.value })} className="mt-2 rounded-xl" placeholder="AAPL"/></label><label className="text-xs font-bold text-slate-600">Tipo<select value={alertDraft.kind} onChange={(event) => setAlertDraft({ ...alertDraft, kind: event.target.value as AlertKind })} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="beneficio">Beneficio</option><option value="pérdida">Pérdida</option><option value="volumen">Volumen</option><option value="tendencia">Cambio de tendencia</option></select></label><label className="text-xs font-bold text-slate-600">Umbral<Input type="number" value={alertDraft.threshold} onChange={(event) => setAlertDraft({ ...alertDraft, threshold: event.target.value })} className="mt-2 rounded-xl"/></label><Button onClick={saveAlert} className="rounded-xl bg-blue-600 font-bold">Activar seguimiento</Button></DialogContent></Dialog>
  </div>;
}
