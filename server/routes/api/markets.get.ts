type Instrument = { symbol: string; label: string; name: string };

const markets: Record<string, Instrument[]> = {
  acciones: [
    ["AAPL", "AAPL", "Apple"], ["NVDA", "NVDA", "NVIDIA"], ["MSFT", "MSFT", "Microsoft"],
    ["AMZN", "AMZN", "Amazon"], ["META", "META", "Meta"], ["TSLA", "TSLA", "Tesla"],
    ["GOOGL", "GOOGL", "Alphabet"], ["AMD", "AMD", "AMD"], ["JPM", "JPM", "JPMorgan Chase"],
    ["SAN", "SAN", "Banco Santander"], ["PLTR", "PLTR", "Palantir"], ["NFLX", "NFLX", "Netflix"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  europa: [
    ["SAN.MC", "SAN", "Banco Santander"], ["IBE.MC", "IBE", "Iberdrola"], ["ITX.MC", "ITX", "Inditex"],
    ["SAP.DE", "SAP", "SAP"], ["SIE.DE", "SIE", "Siemens"], ["AIR.PA", "AIR", "Airbus"],
    ["MC.PA", "MC", "LVMH"], ["ASML.AS", "ASML", "ASML"], ["SHEL.L", "SHEL", "Shell"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  cripto: [
    ["BTC-USD", "BTC", "Bitcoin"], ["ETH-USD", "ETH", "Ethereum"], ["BNB-USD", "BNB", "BNB"],
    ["SOL-USD", "SOL", "Solana"], ["XRP-USD", "XRP", "XRP"], ["ADA-USD", "ADA", "Cardano"],
    ["DOGE-USD", "DOGE", "Dogecoin"], ["AVAX-USD", "AVAX", "Avalanche"], ["LINK-USD", "LINK", "Chainlink"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  etfs: [
    ["SPY", "SPY", "SPDR S&P 500 ETF"], ["QQQ", "QQQ", "Invesco QQQ"], ["VOO", "VOO", "Vanguard S&P 500"],
    ["VTI", "VTI", "Vanguard Total Market"], ["IWM", "IWM", "iShares Russell 2000"], ["GLD", "GLD", "SPDR Gold Shares"],
    ["IBIT", "IBIT", "iShares Bitcoin Trust"], ["ARKK", "ARKK", "ARK Innovation"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  fondos: [
    ["VFIAX", "VFIAX", "Vanguard 500 Index Admiral"], ["VTSAX", "VTSAX", "Vanguard Total Stock Market"],
    ["FXAIX", "FXAIX", "Fidelity 500 Index"], ["FSKAX", "FSKAX", "Fidelity Total Market"],
    ["SWPPX", "SWPPX", "Schwab S&P 500 Index"], ["VWELX", "VWELX", "Vanguard Wellington"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  pequenas: [
    ["SOUN", "SOUN", "SoundHound AI"], ["BBAI", "BBAI", "BigBear.ai"], ["LUNR", "LUNR", "Intuitive Machines"],
    ["RKLB", "RKLB", "Rocket Lab"], ["IONQ", "IONQ", "IonQ"], ["RGTI", "RGTI", "Rigetti Computing"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  indices: [
    ["^IBEX", "IBEX 35", "IBEX 35"], ["^GSPC", "S&P 500", "S&P 500"], ["^IXIC", "NASDAQ", "Nasdaq Composite"],
    ["^DJI", "DOW", "Dow Jones"], ["^STOXX50E", "EURO50", "Euro Stoxx 50"], ["^GDAXI", "DAX", "DAX"],
    ["^N225", "NIKKEI", "Nikkei 225"], ["^HSI", "HANG SENG", "Hang Seng"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  forex: [
    ["EURUSD=X", "EUR/USD", "Euro / Dólar"], ["GBPUSD=X", "GBP/USD", "Libra / Dólar"], ["USDJPY=X", "USD/JPY", "Dólar / Yen"],
    ["USDCHF=X", "USD/CHF", "Dólar / Franco suizo"], ["AUDUSD=X", "AUD/USD", "Dólar australiano / Dólar"],
    ["EURGBP=X", "EUR/GBP", "Euro / Libra"], ["EURJPY=X", "EUR/JPY", "Euro / Yen"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
  materias: [
    ["GC=F", "ORO", "Oro"], ["SI=F", "PLATA", "Plata"], ["CL=F", "WTI", "Petróleo WTI"],
    ["BZ=F", "BRENT", "Petróleo Brent"], ["NG=F", "GAS", "Gas natural"], ["HG=F", "COBRE", "Cobre"],
    ["ZW=F", "TRIGO", "Trigo"], ["ZC=F", "MAÍZ", "Maíz"], ["KC=F", "CAFÉ", "Café"],
  ].map(([symbol, label, name]) => ({ symbol, label, name })),
};

async function quote(instrument: Instrument) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(instrument.symbol)}?range=5d&interval=30m`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ARES-Vigia/13" } });
  if (!response.ok) throw new Error(`Proveedor ${response.status}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  const timestamps: number[] = result?.timestamp ?? [];
  const points = closes.flatMap((value, index) => value == null ? [] : [{
    time: new Date((timestamps[index] ?? 0) * 1000).toISOString(),
    value: Number(value.toFixed(6)),
  }]);
  const price = Number(meta?.regularMarketPrice ?? points.at(-1)?.value ?? 0);
  const previous = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? points.at(-2)?.value ?? price);
  const change = previous ? ((price - previous) / previous) * 100 : 0;
  return {
    symbol: instrument.label,
    ticker: instrument.symbol,
    name: instrument.name,
    price,
    change: Number(change.toFixed(2)),
    currency: meta?.currency ?? "",
    exchange: meta?.exchangeName ?? "Mercado",
    updatedAt: new Date((meta?.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    points: points.slice(-80),
  };
}

export default defineEventHandler(async (event) => {
  const requested = String(getQuery(event).market ?? "acciones").toLowerCase();
  const instruments = markets[requested];
  if (!instruments) return { market: requested, items: [], error: "Mercado no válido" };
  const results = await Promise.allSettled(instruments.map(quote));
  const items = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  return {
    market: requested,
    source: "Yahoo Finance · consulta web segura",
    updatedAt: new Date().toISOString(),
    items,
    error: items.length ? null : "El proveedor no ha devuelto datos en este momento",
  };
});
