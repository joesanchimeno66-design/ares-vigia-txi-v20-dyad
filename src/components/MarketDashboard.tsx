import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bitcoin,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Gem,
  Layers3,
  LineChart,
  Repeat2,
  Search,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";

const categories = [
  { id: "stocks", label: "Stocks", icon: LineChart, tone: "blue" },
  { id: "crypto", label: "Crypto", icon: Bitcoin, tone: "violet" },
  { id: "etfs", label: "ETFs", icon: Layers3, tone: "cyan" },
  { id: "forex", label: "Forex", icon: Repeat2, tone: "orange" },
  { id: "indices", label: "Indices", icon: BarChart3, tone: "green" },
  { id: "commodities", label: "Commodities", icon: Gem, tone: "amber" },
] as const;

type CategoryId = (typeof categories)[number]["id"];

type MarketItem = {
  symbol: string;
  name: string;
  price: string;
  change: number;
};

const marketData: Record<CategoryId, MarketItem[]> = {
  stocks: [
    { symbol: "AAPL", name: "Apple", price: "$227.16", change: 1.42 },
    { symbol: "NVDA", name: "NVIDIA", price: "$138.85", change: 2.76 },
    { symbol: "MSFT", name: "Microsoft", price: "$418.79", change: -0.34 },
    { symbol: "AMZN", name: "Amazon", price: "$214.10", change: 0.91 },
  ],
  crypto: [
    { symbol: "BTC", name: "Bitcoin", price: "$96,472", change: 3.18 },
    { symbol: "ETH", name: "Ethereum", price: "$3,412", change: 1.72 },
    { symbol: "SOL", name: "Solana", price: "$189.28", change: -1.04 },
    { symbol: "XRP", name: "XRP", price: "$2.18", change: 0.62 },
  ],
  etfs: [
    { symbol: "SPY", name: "SPDR S&P 500", price: "$592.19", change: 0.68 },
    { symbol: "QQQ", name: "Invesco QQQ", price: "$512.44", change: 1.21 },
    { symbol: "VTI", name: "Vanguard Total Market", price: "$298.72", change: 0.49 },
    { symbol: "IWM", name: "iShares Russell 2000", price: "$221.30", change: -0.28 },
  ],
  forex: [
    { symbol: "EUR/USD", name: "Euro / US Dollar", price: "1.0428", change: 0.22 },
    { symbol: "GBP/USD", name: "British Pound / US Dollar", price: "1.2531", change: -0.18 },
    { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", price: "157.14", change: 0.44 },
    { symbol: "AUD/USD", name: "Australian / US Dollar", price: "0.6218", change: -0.09 },
  ],
  indices: [
    { symbol: "SPX", name: "S&P 500", price: "5,930.85", change: 0.73 },
    { symbol: "NDX", name: "NASDAQ 100", price: "21,180.31", change: 1.16 },
    { symbol: "DJI", name: "Dow Jones", price: "42,635.20", change: 0.31 },
    { symbol: "DAX", name: "DAX 40", price: "20,317.10", change: -0.12 },
  ],
  commodities: [
    { symbol: "GOLD", name: "Gold", price: "$2,648.30", change: 0.84 },
    { symbol: "SILVER", name: "Silver", price: "$30.41", change: 1.19 },
    { symbol: "WTI", name: "Crude Oil WTI", price: "$73.96", change: -1.37 },
    { symbol: "NATGAS", name: "Natural Gas", price: "$3.66", change: 2.08 },
  ],
};

const chartSeeds: Record<CategoryId, number[]> = {
  stocks: [42, 46, 45, 51, 49, 57, 60, 58, 66, 71, 75, 78],
  crypto: [38, 43, 40, 52, 48, 63, 58, 70, 64, 76, 72, 82],
  etfs: [44, 45, 48, 50, 49, 53, 55, 57, 59, 61, 63, 66],
  forex: [51, 49, 52, 48, 50, 54, 51, 55, 53, 57, 56, 59],
  indices: [39, 42, 44, 43, 48, 52, 51, 57, 60, 62, 67, 70],
  commodities: [54, 52, 56, 61, 58, 64, 62, 68, 65, 70, 74, 72],
};

const timeLabels = ["9:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"];

const toneClasses: Record<string, { icon: string; active: string }> = {
  blue: { icon: "bg-blue-50 text-blue-600", active: "border-blue-500 bg-blue-50/70" },
  violet: { icon: "bg-violet-50 text-violet-600", active: "border-violet-500 bg-violet-50/70" },
  cyan: { icon: "bg-cyan-50 text-cyan-700", active: "border-cyan-500 bg-cyan-50/70" },
  orange: { icon: "bg-orange-50 text-orange-600", active: "border-orange-500 bg-orange-50/70" },
  green: { icon: "bg-emerald-50 text-emerald-600", active: "border-emerald-500 bg-emerald-50/70" },
  amber: { icon: "bg-amber-50 text-amber-700", active: "border-amber-500 bg-amber-50/70" },
};

function AresLogo() {
  return (
    <div className="flex items-center gap-3" aria-label="Ares Test">
      <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(37,99,235,0.24)]">
        <svg viewBox="0 0 40 40" className="size-8" aria-hidden="true">
          <path d="M8 30 18.4 9.5a2 2 0 0 1 3.5 0L32 30h-6l-2.3-5H15.9l-2.3 5H8Zm10.1-10h3.4l-1.7-4.2L18.1 20Z" fill="currentColor" />
          <path d="m10.5 25 7-5 5 2 8-8" fill="none" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-[-0.03em] text-slate-900">ARES</span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-700">TEST</span>
        </div>
        <p className="text-xs font-medium text-slate-500">Market intelligence</p>
      </div>
    </div>
  );
}

function ChangeBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {isPositive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

export function MarketDashboard() {
  const [selected, setSelected] = useState<CategoryId>("stocks");
  const [query, setQuery] = useState("");

  const activeCategory = categories.find((category) => category.id === selected)!;
  const rows = marketData[selected].filter((item) =>
    `${item.symbol} ${item.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const chartData = useMemo(
    () => chartSeeds[selected].map((value, index) => ({ time: timeLabels[index], value })),
    [selected],
  );

  return (
    <div className="min-h-screen bg-[#f7f9fd] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <AresLogo />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" /> Market open
            </div>
            <Button variant="ghost" size="icon" className="size-10 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-primary" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <div className="flex size-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">AT</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="relative mb-7 overflow-hidden rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_16px_50px_rgba(30,64,175,0.08)] sm:p-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-70 md:block" aria-hidden="true">
            <svg viewBox="0 0 600 220" className="h-full w-full" preserveAspectRatio="none">
              <path d="M0 180 C90 150 120 175 190 120 S310 140 370 80 S470 105 600 25" fill="none" stroke="#bfdbfe" strokeWidth="3" />
              <path d="M0 205 C85 190 140 200 200 160 S310 180 390 125 S500 150 600 90" fill="none" stroke="#dbeafe" strokeWidth="2" />
              {[90, 190, 290, 390, 490].map((x, index) => <circle key={x} cx={x} cy={180 - index * 26} r="4" fill="#60a5fa" />)}
            </svg>
          </div>
          <div className="relative max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              <Activity className="size-4" /> Live market snapshot
            </div>
            <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-5xl">Your markets, at a glance.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Track the pulse of global markets with a fast, focused workspace built for clarity.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Global market cap</p>
                <p className="mt-1 text-lg font-extrabold">$124.8T <span className="ml-1 text-xs text-emerald-600">+0.84%</span></p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">24h volume</p>
                <p className="mt-1 text-lg font-extrabold">$312.6B</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="markets-heading">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-600">Explore</p>
              <h2 id="markets-heading" className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Market categories</h2>
            </div>
            <p className="hidden text-sm text-slate-500 sm:block">Select a market to update your view</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = selected === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelected(category.id)}
                  className={`group min-h-32 rounded-[22px] border bg-white p-4 text-left shadow-[0_6px_24px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_12px_30px_rgba(37,99,235,0.10)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isActive ? toneClasses[category.tone].active : "border-slate-200"}`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-start justify-between">
                    <span className={`flex size-11 items-center justify-center rounded-2xl ${toneClasses[category.tone].icon}`}><Icon className="size-5" /></span>
                    <ChevronRight className={`size-4 transition-transform group-hover:translate-x-0.5 ${isActive ? "text-primary" : "text-slate-300"}`} />
                  </div>
                  <p className="mt-5 text-base font-extrabold tracking-tight text-slate-900">{category.label}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">View market</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold tracking-tight">{activeCategory.label} momentum</h2>
                  <ChangeBadge value={1.24} />
                </div>
                <p className="mt-1 text-sm text-slate-500">Intraday composite performance</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><Clock3 className="size-3.5" /> Updated just now</div>
            </div>
            <div className="h-[300px] p-4 sm:p-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 5" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={28} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #dbeafe", boxShadow: "0 10px 25px rgba(15,23,42,.08)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fill="#dbeafe" fillOpacity={0.72} activeDot={{ r: 5, fill: "#2563eb", stroke: "white", strokeWidth: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">Top instruments</h2>
                  <p className="mt-1 text-sm text-slate-500">Most watched in {activeCategory.label}</p>
                </div>
                <CircleDollarSign className="size-6 text-blue-500" />
              </div>
              <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <Search className="size-4 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol or name" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" />
              </label>
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((item) => (
                <div key={item.symbol} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-900">{item.symbol}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-slate-900">{item.price}</p>
                    <p className={`mt-0.5 text-xs font-bold ${item.change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%</p>
                  </div>
                </div>
              ))}
              {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-slate-500">No matching instruments found.</p>}
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 py-6 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2025 Ares Test. Built for demonstration purposes.</p>
          <p>All prices are simulated and do not represent live market data.</p>
        </footer>
      </main>
    </div>
  );
}
