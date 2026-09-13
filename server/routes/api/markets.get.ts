import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { tradingViewDaily } from "../../utils/tradingview";

type Instrument = { symbol: string; label: string; name: string; stooq?: string; code?: string; tradingView?: string; currency?: string };
type Point = { time: string; value: number; open: number; high: number; low: number; volume: number | null };
type Metrics = {
  returns: { intraday: number | null; week: number | null; month: number | null; threeMonths: number | null; sixMonths: number | null; year: number | null };
  ema9: number | null; ema21: number | null; emaSlope: number | null; rsi14: number | null; macd: number | null;
  macdSignal: number | null; macdHistogram: number | null; bollingerZ: number | null; bollingerExpansion: number | null;
  volumeRatio: number | null; volumeTrend: number | null; support: number | null; resistance: number | null;
  breakoutPct: number | null; failedBreakout: boolean; volatility: number | null;
  trend: "alcista" | "bajista" | "lateral" | null; samples: number;
};
type Quote = {
  symbol: string; ticker: string; name: string; price: number; previousClose: number; open: number; high: number; low: number; volume: number | null; change: number;
  currency: string; exchange: string; updatedAt: string; chartSymbol: string;
  priceProvider: string; changeProvider: string; historyProvider: string;
  points: Point[]; metrics: Metrics;
};

const nyseSymbols = new Set(["ABBV","BAC","BA","BBAI","CAT","CRM","CVX","DIS","GE","GS","HD","IBM","IONQ","JNJ","JPM","KO","LLY","LOW","MA","MCD","MRK","MS","NKE","NOW","ORCL","PFE","SAN","T","TMO","UBER","UNH","V","WFC","WMT","XOM"]);
const tuples = (rows: string[][], suffix = "us", currency = "USD", tradingViewExchange = "NASDAQ"): Instrument[] => rows.map(([symbol, name]) => ({
  symbol, label: symbol, name, stooq: `${symbol.toLowerCase()}.${suffix}`, code: `us${symbol}`, tradingView: `${symbol === "QQQ" ? "NASDAQ" : nyseSymbols.has(symbol) ? "NYSE" : tradingViewExchange}:${symbol}`, currency,
}));

const usMarkets: Record<"acciones" | "etfs", Instrument[]> = {
  acciones: tuples([
    ["AAPL","Apple"],["NVDA","NVIDIA"],["MSFT","Microsoft"],["AMZN","Amazon"],["META","Meta"],["TSLA","Tesla"],
    ["GOOGL","Alphabet"],["AMD","AMD"],["JPM","JPMorgan Chase"],["SAN","Banco Santander ADR"],["PLTR","Palantir"],["NFLX","Netflix"],
    ["AVGO","Broadcom"],["ORCL","Oracle"],["CRM","Salesforce"],["V","Visa"],["MA","Mastercard"],["XOM","ExxonMobil"],
    ["JNJ","Johnson & Johnson"],["WMT","Walmart"],["KO","Coca-Cola"],["DIS","Walt Disney"],["UBER","Uber"],["INTC","Intel"],
    ["ADBE","Adobe"],["COST","Costco"],["CSCO","Cisco"],["NOW","ServiceNow"],["QCOM","Qualcomm"],["TXN","Texas Instruments"],
    ["AMAT","Applied Materials"],["MU","Micron"],["PANW","Palo Alto Networks"],["INTU","Intuit"],["IBM","IBM"],["GE","GE Aerospace"],
    ["CAT","Caterpillar"],["BA","Boeing"],["GS","Goldman Sachs"],["BAC","Bank of America"],["WFC","Wells Fargo"],["MS","Morgan Stanley"],
    ["NKE","Nike"],["MCD","McDonald’s"],["SBUX","Starbucks"],["PEP","PepsiCo"],["CVX","Chevron"],["MRK","Merck"],
    ["ABBV","AbbVie"],["LLY","Eli Lilly"],["PFE","Pfizer"],["UNH","UnitedHealth"],["HD","Home Depot"],["LOW","Lowe’s"],["T","AT&T"],["TMO","Thermo Fisher"],
  ]),
  etfs: tuples([
    ["SPY","SPDR S&P 500 ETF"],["QQQ","Invesco QQQ"],["VOO","Vanguard S&P 500"],["VTI","Vanguard Total Market"],
    ["IWM","iShares Russell 2000"],["DIA","SPDR Dow Jones"],["VEA","Vanguard Developed Markets"],["VWO","Vanguard Emerging Markets"],
    ["EFA","iShares MSCI EAFE"],["EEM","iShares Emerging Markets"],["XLK","Technology Select Sector"],["XLF","Financial Select Sector"],
    ["XLE","Energy Select Sector"],["XLV","Health Care Select Sector"],["GLD","SPDR Gold Shares"],["SLV","iShares Silver Trust"],
    ["TLT","iShares 20+ Year Treasury"],["HYG","iShares High Yield Bond"],["ARKK","ARK Innovation"],["IBIT","iShares Bitcoin Trust"],
    ["SCHD","Schwab U.S. Dividend Equity"],["IVV","iShares Core S&P 500"],["VIG","Vanguard Dividend Appreciation"],["VYM","Vanguard High Dividend Yield"],
    ["USMV","iShares MSCI USA Min Vol"],["ACWI","iShares MSCI ACWI"],["VT","Vanguard Total World"],["IEFA","iShares Core MSCI EAFE"],
    ["IEMG","iShares Core Emerging Markets"],["BND","Vanguard Total Bond"],["AGG","iShares Core Aggregate Bond"],["LQD","iShares Investment Grade Bond"],
    ["SHY","iShares 1-3 Year Treasury"],["IEF","iShares 7-10 Year Treasury"],["XBI","SPDR S&P Biotech"],["SMH","VanEck Semiconductor"],
    ["SOXX","iShares Semiconductor"],["XLP","Consumer Staples Select Sector"],["XLU","Utilities Select Sector"],["XLY","Consumer Discretionary Select Sector"],
    ["XLI","Industrial Select Sector"],["XLB","Materials Select Sector"],["GDX","VanEck Gold Miners"],["USO","United States Oil Fund"],
  ], "us", "USD", "AMEX"),
};

const europeRows: string[][] = [
  ["SAN.MC","SAN","Banco Santander","san.es","EUR"],["BBVA.MC","BBVA","BBVA","bbva.es","EUR"],["IBE.MC","IBE","Iberdrola","ibe.es","EUR"],["ITX.MC","ITX","Inditex","itx.es","EUR"],
  ["REP.MC","REP","Repsol","rep.es","EUR"],["TEF.MC","TEF","Telefónica","tef.es","EUR"],["FER.MC","FER","Ferrovial","fer.es","EUR"],["ACS.MC","ACS","ACS","acs.es","EUR"],
  ["SAP.DE","SAP","SAP","sap.de","EUR"],["SIE.DE","SIE","Siemens","sie.de","EUR"],["ALV.DE","ALV","Allianz","alv.de","EUR"],["DTE.DE","DTE","Deutsche Telekom","dte.de","EUR"],
  ["BMW.DE","BMW","BMW","bmw.de","EUR"],["MBG.DE","MBG","Mercedes-Benz","mbg.de","EUR"],["BAS.DE","BAS","BASF","bas.de","EUR"],["RHM.DE","RHM","Rheinmetall","rhm.de","EUR"],
  ["AIR.PA","AIR","Airbus","air.fr","EUR"],["MC.PA","MC","LVMH","mc.fr","EUR"],["OR.PA","OR","L'Oréal","or.fr","EUR"],["TTE.PA","TTE","TotalEnergies","tte.fr","EUR"],
  ["SAN.PA","SANOFI","Sanofi","san.fr","EUR"],["BNP.PA","BNP","BNP Paribas","bnp.fr","EUR"],["SU.PA","SU","Schneider Electric","su.fr","EUR"],["RMS.PA","RMS","Hermès","rms.fr","EUR"],
  ["ENEL.MI","ENEL","Enel","enel.it","EUR"],["ENI.MI","ENI","Eni","eni.it","EUR"],["ISP.MI","ISP","Intesa Sanpaolo","isp.it","EUR"],["UCG.MI","UCG","UniCredit","ucg.it","EUR"],
  ["STLAM.MI","STLAM","Stellantis","stlam.it","EUR"],["LDO.MI","LDO","Leonardo","ldo.it","EUR"],["G.MI","G","Generali","g.it","EUR"],["MONC.MI","MONC","Moncler","monc.it","EUR"],
  ["ASML.AS","ASML","ASML","asml.nl","EUR"],["INGA.AS","INGA","ING","inga.nl","EUR"],["ADYEN.AS","ADYEN","Adyen","adyen.nl","EUR"],["PHIA.AS","PHIA","Philips","phia.nl","EUR"],
  ["HEIA.AS","HEIA","Heineken","heia.nl","EUR"],["WKL.AS","WKL","Wolters Kluwer","wkl.nl","EUR"],
  ["SHEL.L","SHEL","Shell","shel.uk","GBX"],["AZN.L","AZN","AstraZeneca","azn.uk","GBX"],["HSBA.L","HSBA","HSBC","hsba.uk","GBX"],["ULVR.L","ULVR","Unilever","ulvr.uk","GBX"],
  ["BP.L","BP","BP","bp.uk","GBX"],["GSK.L","GSK","GSK","gsk.uk","GBX"],["RR.L","RR","Rolls-Royce","rr.uk","GBX"],["BARC.L","BARC","Barclays","barc.uk","GBX"],
  ["EDP.LS","EDP","EDP","edp.pt","EUR"],["GALP.LS","GALP","Galp Energia","galp.pt","EUR"],["JMT.LS","JMT","Jerónimo Martins","jmt.pt","EUR"],
  ["ABI.BR","ABI","AB InBev","abi.be","EUR"],["KBC.BR","KBC","KBC Group","kbc.be","EUR"],["UCB.BR","UCB","UCB","ucb.be","EUR"],
  ["NESN.SW","NESN","Nestlé","nesn.ch","CHF"],["NOVN.SW","NOVN","Novartis","novn.ch","CHF"],["ROG.SW","ROG","Roche","rog.ch","CHF"],["UBSG.SW","UBSG","UBS","ubs.ch","CHF"],
  ["NOVO-B.CO","NOVO B","Novo Nordisk","novo-b.dk","DKK"],["MAERSK-B.CO","MAERSK B","A.P. Moller-Maersk","maersk-b.dk","DKK"],["VWS.CO","VWS","Vestas","vws.dk","DKK"],
  ["ERIC-B.ST","ERIC B","Ericsson","eric-b.se","SEK"],["VOLV-B.ST","VOLV B","Volvo","volv-b.se","SEK"],["ATCO-A.ST","ATCO A","Atlas Copco","atco-a.se","SEK"],
  ["NOKIA.HE","NOKIA","Nokia","nokia.fi","EUR"],["KNEBV.HE","KNEBV","KONE","knebv.fi","EUR"],["FORTUM.HE","FORTUM","Fortum","fortum.fi","EUR"],
];
const europeanExchanges:Record<string,string>={MC:"BME",DE:"XETR",PA:"EURONEXT",MI:"MIL",AS:"EURONEXT",L:"LSE",LS:"EURONEXT",BR:"EURONEXT",SW:"SIX",CO:"OMXCOP",ST:"OMXSTO",HE:"OMXHEX"};
const european: Instrument[] = europeRows.map(([symbol,label,name,stooq,currency]) => {const [ticker,suffix]=symbol.split(".");return{symbol,label,name,stooq,tradingView:`${europeanExchanges[suffix]}:${ticker}`,currency};});

const crypto: Instrument[] = [
  ["bitcoin","BTC","Bitcoin"],["ethereum","ETH","Ethereum"],["binancecoin","BNB","BNB"],["solana","SOL","Solana"],["ripple","XRP","XRP"],
  ["cardano","ADA","Cardano"],["dogecoin","DOGE","Dogecoin"],["tron","TRX","TRON"],["the-open-network","TON","Toncoin"],["avalanche-2","AVAX","Avalanche"],
  ["polkadot","DOT","Polkadot"],["chainlink","LINK","Chainlink"],["litecoin","LTC","Litecoin"],["shiba-inu","SHIB","Shiba Inu"],["uniswap","UNI","Uniswap"],
  ["cosmos","ATOM","Cosmos"],["stellar","XLM","Stellar"],["near","NEAR","NEAR"],["ethereum-classic","ETC","Ethereum Classic"],["hyperliquid","HYPE","Hyperliquid"],
  ["sui","SUI","Sui"],["aptos","APT","Aptos"],["internet-computer","ICP","Internet Computer"],["hedera-hashgraph","HBAR","Hedera"],["pepe","PEPE","Pepe"],
  ["dai","DAI","Dai"],["crypto-com-chain","CRO","Cronos"],["render-token","RENDER","Render"],["arbitrum","ARB","Arbitrum"],["optimism","OP","Optimism"],
  ["injective-protocol","INJ","Injective"],["aave","AAVE","Aave"],["maker","MKR","Maker"],["algorand","ALGO","Algorand"],["vechain","VET","VeChain"],
  ["filecoin","FIL","Filecoin"],["lido-staked-ether","STETH","Lido Staked Ether"],["wrapped-bitcoin","WBTC","Wrapped Bitcoin"],["bittensor","TAO","Bittensor"],["kaspa","KAS","Kaspa"],
].map(([symbol,label,name]) => ({ symbol,label,name,currency:"USD" }));

const forex: Instrument[] = [
  ["EUR/USD","Euro / Dólar","EURUSD"],["GBP/USD","Libra / Dólar","GBPUSD"],["USD/JPY","Dólar / Yen","USDJPY"],["USD/CHF","Dólar / Franco suizo","USDCHF"],
  ["AUD/USD","Dólar australiano / Dólar","AUDUSD"],["USD/CAD","Dólar / Dólar canadiense","USDCAD"],["NZD/USD","Dólar neozelandés / Dólar","NZDUSD"],
  ["EUR/GBP","Euro / Libra","EURGBP"],["EUR/JPY","Euro / Yen","EURJPY"],["GBP/JPY","Libra / Yen","GBPJPY"],["EUR/CHF","Euro / Franco suizo","EURCHF"],["AUD/JPY","Dólar australiano / Yen","AUDJPY"],
].map(([symbol,name,code]) => ({ symbol,label:symbol,name,code:`wh${code}`,stooq:`${code.toLowerCase()}`,tradingView:`OANDA:${code}`,currency:"" }));

const commodities: Instrument[] = [
  ["GC","ORO","Oro","COMEX:GC1!"],["SI","PLATA","Plata","COMEX:SI1!"],["CL","WTI","Petróleo WTI","NYMEX:CL1!"],["OIL","BRENT","Petróleo Brent","NYMEX:BB1!"],["NG","GAS","Gas natural","NYMEX:NG1!"],
  ["HG","COBRE","Cobre","COMEX:HG1!"],["W","TRIGO","Trigo","CBOT:ZW1!"],["C","MAÍZ","Maíz","CBOT:ZC1!"],["S","SOJA","Soja","CBOT:ZS1!"],["KC","CAFÉ","Café","ICEUS:KC1!"],["CC","CACAO","Cacao","ICEUS:CC1!"],
].map(([code,label,name,tradingView]) => ({ symbol:code,label,name,code:`hf_${code}`,stooq:`${code.toLowerCase()}.f`,tradingView,currency:"USD" }));

const indices: Instrument[] = [
  ["^ibex","IBEX 35","IBEX 35","BME:IBC"],["^spx","S&P 500","S&P 500","SP:SPX"],["^ndq","NASDAQ","Nasdaq Composite","NASDAQ:IXIC"],["^dji","DOW","Dow Jones","DJ:DJI"],
  ["^stoxx50e","EURO50","Euro Stoxx 50","TVC:SX5E"],["^dax","DAX","DAX","XETR:DAX"],["^cac","CAC40","CAC 40","EURONEXT:PX1"],["^ukx","FTSE100","FTSE 100","TVC:UKX"],
  ["^nkx","NIKKEI","Nikkei 225","TVC:NI225"],["^hsi","HANGSENG","Hang Seng","TVC:HSI"],
].map(([stooq,label,name,tradingView]) => ({ symbol:stooq,label,name,stooq,tradingView,currency:"" }));

const funds = tuples([
  ["VFIAX","Vanguard 500 Index Admiral"],["VTSAX","Vanguard Total Market"],["VBTLX","Vanguard Total Bond Market"],["FXAIX","Fidelity 500 Index"],
  ["FSKAX","Fidelity Total Market"],["FXNAX","Fidelity U.S. Bond Index"],["SWPPX","Schwab S&P 500 Index"],["SWTSX","Schwab Total Market"],
  ["SWAGX","Schwab Aggregate Bond"],["VWELX","Vanguard Wellington"],["PRWCX","T. Rowe Price Capital Appreciation"],["DODGX","Dodge & Cox Stock"],
]);
const smallCaps = tuples([
  ["SOUN","SoundHound AI"],["BBAI","BigBear.ai"],["LUNR","Intuitive Machines"],["RKLB","Rocket Lab"],["IONQ","IonQ"],["RGTI","Rigetti Computing"],
]);

function num(value: unknown) { const cleaned=String(value??"").trim().replace(/[$€£%\s]/g,"").replace(/,(?=\d{3}(?:\D|$))/g,"").replace(",",".");if(!cleaned||cleaned==="-"||cleaned==="--"||cleaned.toLowerCase()==="null")return null;const parsed=Number(cleaned);return Number.isFinite(parsed)?parsed:null; }
function pct(current: number, previous?: number) { return previous && previous > 0 ? (current - previous) / previous * 100 : null; }
function validPoint(time: string, open: number | null, high: number | null, low: number | null, close: number | null, volume: number | null): Point[] {
  if(!/^\d{4}-\d{2}-\d{2}/.test(time)||open===null||high===null||low===null||close===null||Math.min(open,high,low,close)<=0||high<Math.max(open,close)||low>Math.min(open,close))return[];
  const parsedTime=/^\d{4}-\d{2}-\d{2}$/.test(time)?`${time}T16:00:00Z`:new Date(time).toISOString();
  return[{time:parsedTime,value:close,open,high,low,volume:volume!==null&&volume>=0?volume:null}];
}
function ensureHistory(points:Point[],provider:string){
  const unique=[...new Map(points.map(point=>[point.time,point])).values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)).slice(-420);
  const span=unique.length>1?(Date.parse(unique.at(-1)!.time)-Date.parse(unique[0].time))/86400000:0;
  if(unique.length<70||span<350)throw new Error(`${provider}: histórico OHLC insuficiente (${unique.length} velas, ${Math.round(span)} días)`);
  return unique;
}
function snapshot(points:Point[]){const current=points.at(-1)!;const previous=points.at(-2)!;return{previousClose:previous.value,open:current.open,high:current.high,low:current.low,volume:current.volume};}
function buildQuote(instrument:Instrument,history:Point[],historyProvider:string,live:LiveQuote|null,currency=instrument.currency??"",marketLabel="mercado público"):Quote{
  const current=history.at(-1)!;const price=live?.price??current.value;const change=live?.change??pct(current.value,history.at(-2)?.value)??0;const updatedAt=live?.updatedAt??current.time;const priceProvider=live?.provider??historyProvider;const calculated=metrics(history,change);
  const required=[calculated.ema9,calculated.ema21,calculated.rsi14,calculated.macd,calculated.macdSignal,calculated.bollingerZ,calculated.support,calculated.resistance,calculated.volatility,calculated.returns.week,calculated.returns.threeMonths,calculated.returns.sixMonths,calculated.returns.year];if(required.some(value=>value===null||!Number.isFinite(value)))throw new Error(`${historyProvider}: indicadores u horizontes insuficientes`);
  return{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,...snapshot(history),change,currency,exchange:`${priceProvider} · ${marketLabel}`,updatedAt,chartSymbol:instrument.stooq??instrument.symbol,priceProvider,changeProvider:live?`${priceProvider} (precio vs. cierre anterior)`:`${historyProvider} (cierre vs. cierre anterior)`,historyProvider:`${historyProvider} · OHLC real`,points:history,metrics:calculated};
}
function ema(values: number[], period: number) { if (!values.length) return null; const a=2/(period+1); return values.slice(1).reduce((v,x)=>a*x+(1-a)*v,values[0]); }
function emaSeries(values: number[], period: number) { if (!values.length) return []; const a=2/(period+1); const out=[values[0]]; for(const x of values.slice(1)) out.push(a*x+(1-a)*out[out.length-1]); return out; }
function rsi(values: number[], period=14) { if(values.length<period+1)return null; let gains=0,losses=0; for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1];gains+=Math.max(d,0);losses+=Math.max(-d,0);} if(!losses)return 100; const rs=(gains/period)/(losses/period); return 100-100/(1+rs); }
function metrics(points: Point[], intraday: number | null): Metrics {
  const values=points.map(p=>p.value).filter(Number.isFinite); const last=values.at(-1) ?? 0;const lastTime=Date.parse(points.at(-1)?.time??"");
  const at=(days:number)=>{const target=lastTime-days*86400000;const candidate=points.reduce<Point|null>((best,point)=>!best||Math.abs(Date.parse(point.time)-target)<Math.abs(Date.parse(best.time)-target)?point:best,null);return candidate&&Math.abs(Date.parse(candidate.time)-target)<=Math.max(10,days*.05)*86400000?pct(last,candidate.value):null;};
  const ema9Series=values.length>=9?emaSeries(values.slice(-120),9):[];
  const e9=ema9Series.at(-1)??null,e21=values.length>=21?ema(values.slice(-120),21):null;
  const previousEma9=ema9Series.length>5?ema9Series.at(-6)??null:null;
  const emaSlope=e9!==null&&previousEma9!==null&&previousEma9>0?pct(e9,previousEma9):null;
  let macd:null|number=null,signal:null|number=null,hist:null|number=null;
  if(values.length>=35){const e12=emaSeries(values,12),e26=emaSeries(values,26);const series=e12.map((v,i)=>v-e26[i]);macd=series.at(-1)??null;signal=ema(series.slice(-9),9);hist=macd!==null&&signal!==null?macd-signal:null;}
  let z:null|number=null,bandExpansion:null|number=null;
  if(values.length>=40){const width=(window:number[])=>{const mean=window.reduce((a,b)=>a+b,0)/window.length;const sd=Math.sqrt(window.reduce((a,b)=>a+(b-mean)**2,0)/window.length);return mean>0?sd*4/mean:null;};const current=values.slice(-20),previous=values.slice(-40,-20);const currentMean=current.reduce((a,b)=>a+b,0)/current.length;const currentSd=Math.sqrt(current.reduce((a,b)=>a+(b-currentMean)**2,0)/current.length);z=currentSd?(last-currentMean)/currentSd:0;const currentWidth=width(current),previousWidth=width(previous);bandExpansion=currentWidth!==null&&previousWidth!==null&&previousWidth>0?pct(currentWidth,previousWidth):null;}
  else if(values.length>=20){const w=values.slice(-20),mean=w.reduce((a,b)=>a+b,0)/w.length;const sd=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length);z=sd?(last-mean)/sd:0;}
  const volumeValues=points.map(point=>point.volume??null);const lastVolume=volumeValues.at(-1);const currentVolume=lastVolume!==null&&lastVolume!==undefined&&lastVolume>0?lastVolume:null;const priorVolumes=volumeValues.slice(0,-1).filter((value):value is number=>value!==null&&value>0).slice(-20);const averageVolume=priorVolumes.length>=5?priorVolumes.reduce((a,b)=>a+b,0)/priorVolumes.length:null;const volumeRatio=currentVolume!==null&&averageVolume!==null&&averageVolume>0?currentVolume/averageVolume:null;const recentVolumes=priorVolumes.slice(-6);const volumeTrend=recentVolumes.length===6&&recentVolumes.slice(0,3).reduce((a,b)=>a+b,0)>0?recentVolumes.slice(3).reduce((a,b)=>a+b,0)/recentVolumes.slice(0,3).reduce((a,b)=>a+b,0)-1:null;
  const prior20=values.slice(-21,-1);const support=prior20.length>=10?Math.min(...prior20):null,resistance=prior20.length>=10?Math.max(...prior20):null;const breakoutPct=resistance!==null&&resistance>0?pct(last,resistance):null;const previous=values.at(-2)??null;const olderResistance=values.length>=22?Math.max(...values.slice(-22,-2)):null;const failedBreakout=previous!==null&&olderResistance!==null&&previous>olderResistance&&last<=olderResistance;
  const daily=values.slice(-31).flatMap((v,i,a)=>i&&a[i-1]>0?[(v-a[i-1])/a[i-1]]:[]);const vol=daily.length>=2?Math.sqrt(daily.reduce((a,b)=>a+b*b,0)/daily.length)*Math.sqrt(252)*100:null;
  const trend=e9!==null&&e21!==null?(e9>e21*1.002?"alcista":e9<e21*.998?"bajista":"lateral"):null;
  return {returns:{intraday,week:at(5),month:at(21),threeMonths:at(63),sixMonths:at(126),year:at(252)},ema9:e9,ema21:e21,emaSlope,rsi14:rsi(values),macd,macdSignal:signal,macdHistogram:hist,bollingerZ:z,bollingerExpansion:bandExpansion,volumeRatio,volumeTrend,support,resistance,breakoutPct,failedBreakout,volatility:vol,trend,samples:values.length};
}
function parseLines(text:string){const rows=new Map<string,string>();for(const raw of text.replace(/\r|\n/g,"").split(";")){if(!raw.includes("="))continue;const [left,...right]=raw.split("=");const key=left.trim().replace("var ","").replace("hq_str_","").replace("v_","").toLowerCase();const value=right.join("=").trim().replace(/^"|"$/g,"");if(key&&value)rows.set(key,value);}return rows;}
async function providerText(url:string,referer:string){const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 ARES-Vigia/13",Referer:referer,Accept:"*/*"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return new TextDecoder("gbk").decode(await response.arrayBuffer());}
async function tencent(codes:string[]){return providerText(`https://qt.gtimg.cn/q=${codes.join(",")}`,"https://gu.qq.com/");}
async function sina(codes:string[]){return providerText(`https://hq.sinajs.cn/list=${codes.join(",")}`,"https://finance.sina.com.cn/");}

type LiveQuote = { price: number; change: number; updatedAt: string; provider: string };
const deriveChange=(price:number,previous:number|null,reported:number|null)=>previous!==null&&previous>0?pct(price,previous)??0:reported??0;

async function eastmoneyId(instrument:Instrument){
  const suggest=new URL("https://searchapi.eastmoney.com/api/suggest/get");suggest.searchParams.set("input",instrument.symbol);suggest.searchParams.set("type","14");suggest.searchParams.set("token","D43BF722C8E33BDC906FB84D85E326E8");
  const response=await fetch(suggest,{headers:{Accept:"application/json",Referer:"https://quote.eastmoney.com/"},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`Eastmoney búsqueda HTTP ${response.status}`);
  const payload=await response.json() as {QuotationCodeTable?:{Data?:Array<{Code?:string;QuoteID?:string;Name?:string}>}};const candidates=payload.QuotationCodeTable?.Data??[];const symbol=instrument.symbol.toUpperCase(),base=symbol.split(".")[0];const exact=candidates.find(item=>String(item.Code??"").toUpperCase()===symbol)??candidates.find(item=>String(item.Code??"").toUpperCase()===base&&String(item.Name??"").toLowerCase()===instrument.name.toLowerCase());if(!exact?.QuoteID)throw new Error(`Eastmoney sin identificador exacto (${candidates.slice(0,3).map(item=>`${item.Code}:${item.QuoteID}:${item.Name}`).join("|")})`);return exact.QuoteID;
}
async function eastmoneyQuote(instrument:Instrument):Promise<LiveQuote>{
  const secid=await eastmoneyId(instrument);const response=await fetch(`https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}&fields=f43,f59,f60,f124,f170`,{headers:{Accept:"application/json",Referer:"https://quote.eastmoney.com/"},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`Eastmoney HTTP ${response.status}`);const payload=await response.json() as {data?:Record<string,unknown>};const data=payload.data;if(!data)throw new Error("Eastmoney sin cotización");const decimals=num(data.f59)??2,scale=10**decimals,priceRaw=num(data.f43),previousRaw=num(data.f60);if(priceRaw===null||priceRaw<=0)throw new Error("Eastmoney precio inválido");const price=priceRaw/scale,previous=previousRaw!==null?previousRaw/scale:null,reportedRaw=num(data.f170);const change=deriveChange(price,previous,reportedRaw!==null?reportedRaw/100:null);const epoch=num(data.f124);return{price,change,updatedAt:epoch&&epoch>0?new Date(epoch*1000).toISOString():new Date().toISOString(),provider:"Eastmoney"};
}
async function eastmoneyHistory(instrument:Instrument):Promise<Point[]>{
  const cacheKey=`eastmoney:${instrument.symbol}`,cached=historyCache.get(cacheKey);if(cached&&cached.expires>Date.now())return cached.points;const secid=await eastmoneyId(instrument);
  const response=await fetch(`https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&klt=101&fqt=1&lmt=420&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56`,{headers:{Accept:"application/json",Referer:"https://quote.eastmoney.com/"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`Eastmoney OHLC HTTP ${response.status}`);const payload=await response.json() as {data?:{klines?:string[]}};
  const points=ensureHistory((payload.data?.klines??[]).flatMap(line=>{const f=line.split(",");return validPoint(f[0],num(f[1]),num(f[3]),num(f[4]),num(f[2]),num(f[5]));}),"Eastmoney");historyCache.set(cacheKey,{expires:Date.now()+5*60_000,points});return points;
}

const historyCache=new Map<string,{expires:number;points:Point[]}>();
async function settleBatched<T,R>(items:T[],worker:(item:T)=>Promise<R>,size=8){
  const output:PromiseSettledResult<R>[]=[];
  for(let index=0;index<items.length;index+=size){
    const batch=items.slice(index,index+size);
    output.push(...await Promise.all(batch.map(async item=>{try{return{status:"fulfilled",value:await worker(item)} as PromiseFulfilledResult<R>;}catch(reason){return{status:"rejected",reason} as PromiseRejectedResult;}})));
  }
  return output;
}

async function nasdaqHistory(instrument:Instrument):Promise<Point[]>{
  const cacheKey=`nasdaq:${instrument.symbol}`,cached=historyCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return cached.points;
  const errors:string[]=[];
  const end=new Date(),start=new Date(Date.now()-1200*86400000);
  const date=(value:Date)=>`${String(value.getUTCMonth()+1).padStart(2,"0")}/${String(value.getUTCDate()).padStart(2,"0")}/${value.getUTCFullYear()}`;
  for(const assetclass of ["stocks","etf","mutualfunds"]){
    try{
      const url=new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(instrument.symbol)}/historical`);
      url.searchParams.set("assetclass",assetclass);url.searchParams.set("fromdate",date(start));url.searchParams.set("limit","5000");
      const response=await fetch(url,{headers:{Accept:"application/json, text/plain, */*","Accept-Language":"en-US,en;q=0.9","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",Referer:`https://www.nasdaq.com/market-activity/${assetclass}/${instrument.symbol.toLowerCase()}/historical`},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json() as {data?:{tradesTable?:{rows?:Array<Record<string,unknown>>}}};
      const rows=payload.data?.tradesTable?.rows??[];
      if(!rows.length)throw new Error(`sin filas (${JSON.stringify(payload.data).slice(0,120)})`);
      const points=rows.flatMap(row=>{const stamp=String(row.date??"").trim();const match=stamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!match)return[];return validPoint(`${match[3]}-${match[1].padStart(2,"0")}-${match[2].padStart(2,"0")}`,num(row.open),num(row.high),num(row.low),num(row.close??row.last),num(row.volume));});
      const valid=ensureHistory(points,"Nasdaq");historyCache.set(cacheKey,{expires:Date.now()+5*60_000,points:valid});return valid;
    }catch(error){errors.push(`${assetclass}: ${error instanceof Error?error.message:"sin datos"}`);}
  }
  throw new Error(errors.join(" · "));
}
async function fmpHistory(instrument:Instrument){const response=await fetch(`https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(instrument.symbol)}?apikey=demo`,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`FMP HTTP ${response.status}`);const payload=await response.json() as {historical?:Array<Record<string,unknown>>};return ensureHistory((payload.historical??[]).flatMap(row=>validPoint(String(row.date??""),num(row.open),num(row.high),num(row.low),num(row.close),num(row.volume))),"FMP");}
async function tradingViewHistory(instrument:Instrument){
  if(!instrument.tradingView)throw new Error("TradingView sin símbolo compatible");
  const cacheKey=`tradingview:${instrument.tradingView}`,cached=historyCache.get(cacheKey);if(cached&&cached.expires>Date.now())return cached.points;
  const candles=await tradingViewDaily(instrument.tradingView,420);
  const points=ensureHistory(candles.flatMap(candle=>validPoint(candle.time,candle.open,candle.high,candle.low,candle.close,candle.volume)),"TradingView");
  historyCache.set(cacheKey,{expires:Date.now()+5*60_000,points});return points;
}

async function stooqHistory(symbol:string):Promise<Point[]>{
  const cached=historyCache.get(symbol);if(cached&&cached.expires>Date.now())return cached.points;
  const end=new Date(),start=new Date(Date.now()-1200*86400000);const d=(x:Date)=>x.toISOString().slice(0,10).replace(/-/g,"");const errors:string[]=[];
  for(const host of ["stooq.pl","stooq.com"]){try{const url=`https://${host}/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${d(start)}&d2=${d(end)}&i=d`;const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; ARES-Vigia/22)",Accept:"text/csv,application/csv;q=0.9,*/*;q=0.1",Referer:`https://${host}/`},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const body=(await response.text()).trim();const parsed=body.split(/\r?\n/).slice(1).flatMap(line=>{const f=line.split(",");return validPoint(f[0],num(f[1]),num(f[2]),num(f[3]),num(f[4]),num(f[5]));});if(!parsed.length)throw new Error(`sin OHLC (${body.slice(0,45)})`);const points=ensureHistory(parsed,"Stooq");historyCache.set(symbol,{expires:Date.now()+5*60_000,points});return points;}catch(error){errors.push(`${host}: ${error instanceof Error?error.message:"fuente no disponible"}`);}}
  throw new Error(errors.join(" · "));
}
function dukascopySymbol(instrument:Instrument){const indexMap:Record<string,string>={"^ibex":"ESP.IDX/EUR","^spx":"USA500.IDX/USD","^ndq":"USATECH.IDX/USD","^dji":"USA30.IDX/USD","^stoxx50e":"EUS.IDX/EUR","^dax":"DEU.IDX/EUR","^cac":"FRA.IDX/EUR","^ukx":"GBR.IDX/GBP","^nkx":"JPN.IDX/JPY","^hsi":"HKG.IDX/HKD"};const commodityMap:Record<string,string>={GC:"XAU/USD",SI:"XAG/USD",CL:"LIGHT.CMD/USD",OIL:"BRENT.CMD/USD",NG:"GAS.CMD/USD",HG:"COPPER.CMD/USD"};return indexMap[instrument.symbol]??commodityMap[instrument.symbol]??(instrument.symbol.includes("/")?instrument.symbol:null);}
async function dukascopyHistory(instrument:Instrument){const symbol=dukascopySymbol(instrument);if(!symbol)throw new Error("Dukascopy sin símbolo compatible");const end=Date.now(),start=end-1200*86400000;const url=new URL("https://freeserv.dukascopy.com/2.0/index.php");url.searchParams.set("path","chart/json3");url.searchParams.set("instrument",symbol);url.searchParams.set("offer_side","B");url.searchParams.set("interval","DAY");url.searchParams.set("splits","true");url.searchParams.set("stocks","true");url.searchParams.set("start",String(start));url.searchParams.set("end",String(end));const response=await fetch(url,{headers:{Accept:"application/json,text/javascript,*/*;q=0.1",Referer:"https://www.dukascopy.com/"},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Dukascopy HTTP ${response.status}`);const body=await response.text();const jsonStart=body.indexOf("{");const jsonEnd=body.lastIndexOf("}");if(jsonStart<0||jsonEnd<jsonStart)throw new Error(`Dukascopy respuesta inválida (${body.slice(0,60)})`);const payload=JSON.parse(body.slice(jsonStart,jsonEnd+1)) as {data?:unknown[]};const points=(Array.isArray(payload.data)?payload.data:[]).flatMap((row):Point[]=>{if(Array.isArray(row))return validPoint(new Date(Number(row[0])).toISOString(),num(row[1]),num(row[2]),num(row[3]),num(row[4]),num(row[5]));if(row&&typeof row==="object"){const item=row as Record<string,unknown>;return validPoint(new Date(Number(item.time??item.timestamp)).toISOString(),num(item.open),num(item.high),num(item.low),num(item.close),num(item.volume));}return[];});return ensureHistory(points,"Dukascopy");}
type HistoryProvider="Tencent"|"Eastmoney"|"Nasdaq"|"FMP"|"TradingView"|"Stooq"|"Dukascopy";
async function selectHistory(instrument:Instrument,order:HistoryProvider[]){
  const errors:string[]=[];for(const provider of order){try{const points=provider==="Tencent"?await tencentDailyHistory(instrument):provider==="Eastmoney"?await eastmoneyHistory(instrument):provider==="Nasdaq"?await nasdaqHistory(instrument):provider==="FMP"?await fmpHistory(instrument):provider==="TradingView"?await tradingViewHistory(instrument):provider==="Dukascopy"?await dukascopyHistory(instrument):await stooqHistory(instrument.stooq??instrument.symbol);return{points,provider};}catch(error){errors.push(`${provider}: ${error instanceof Error?error.message:"fuente no disponible"}`);}}
  console.warn("ARES_V22_FUENTES",instrument.symbol,errors.join(" · "));throw new Error(errors.join(" · "));
}
async function preferredQuote(instrument:Instrument):Promise<Quote>{
  const history=await selectHistory(instrument,["Eastmoney","TradingView","Dukascopy","Stooq","Tencent"]);let live:LiveQuote|null=null;
  try{live=await eastmoneyQuote(instrument);}catch{live=null;}
  return buildQuote(instrument,history.points,history.provider,live);
}
async function stooqSet(instruments:Instrument[]){const results=await settleBatched(instruments,preferredQuote,1);return results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);}
async function tencentDailyHistory(instrument:Instrument):Promise<Point[]>{
  if(!instrument.code)throw new Error("Tencent sin código");
  const cacheKey=`tencent:${instrument.code.toLowerCase()}`,cached=historyCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return cached.points;
  const parameter=encodeURIComponent(`${instrument.code},day,,,420,qfq`),errors:string[]=[];
  for(const endpoint of [`https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get?param=${parameter}`,`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${parameter}`]){
    try{
      const response=await fetch(endpoint,{headers:{Accept:"application/json",Referer:"https://gu.qq.com/","User-Agent":"Mozilla/5.0 (compatible; ARES-Vigia/22)"},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json() as {data?:Record<string,Record<string,unknown>>};
      const bucket=payload.data?.[instrument.code]??payload.data?.[instrument.code.toLowerCase()];
      const rows=(bucket?.qfqday??bucket?.day) as unknown;
      const points=ensureHistory((Array.isArray(rows)?rows:[]).flatMap((row):Point[]=>{if(!Array.isArray(row))return[];return validPoint(String(row[0]??""),num(row[1]),num(row[3]),num(row[4]),num(row[2]),num(row[5]));}),"Tencent");
      historyCache.set(cacheKey,{expires:Date.now()+5*60_000,points});return points;
    }catch(error){errors.push(error instanceof Error?error.message:"fuente no disponible");}
  }
  throw new Error(errors.join(" / ")||"Tencent histórico no disponible");
}
async function usSet(market:"acciones"|"etfs", instruments:Instrument[]=usMarkets[market]){
  let tencentRows=new Map<string,string>(),sinaRows=new Map<string,string>();
  try{tencentRows=parseLines(await tencent(instruments.map(i=>i.code!)));}catch{tencentRows=new Map();}
  try{sinaRows=parseLines(await sina(instruments.map(i=>`gb_${i.symbol.toLowerCase()}`)));}catch{sinaRows=new Map();}
  const results=await settleBatched(instruments,async(instrument):Promise<Quote>=>{
    const history=await selectHistory(instrument,["Tencent","Eastmoney","TradingView","Nasdaq","FMP","Stooq"]);
    const tf=tencentRows.get(instrument.code!.toLowerCase())?.split("~")??[];const tPrice=num(tf[3]),tPrevious=num(tf[4]);
    const sf=sinaRows.get(`gb_${instrument.symbol.toLowerCase()}`)?.split(",")??[];const sPrice=num(sf[1]);
    let live:LiveQuote|null=null;
    if(tPrice!==null&&tPrice>0){const raw=tf[30];live={price:tPrice,change:deriveChange(tPrice,tPrevious,num(tf[32])),updatedAt:/^\d{14}$/.test(raw??"")?`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(8,10)}:${raw.slice(10,12)}:${raw.slice(12,14)}-04:00`:new Date().toISOString(),provider:"Tencent"};}
    else if(sPrice!==null&&sPrice>0){live={price:sPrice,change:deriveChange(sPrice,null,num(sf[2])),updatedAt:sf[3]&&Number.isFinite(Date.parse(sf[3]))?new Date(sf[3]).toISOString():new Date().toISOString(),provider:"Sina"};}
    else{try{live=await eastmoneyQuote(instrument);}catch{live=null;}}
    return buildQuote(instrument,history.points,history.provider,live,"USD",market==="etfs"?"ETF USA":"acciones USA");
  });
  return results.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
}
async function binanceHistory(instrument:Instrument){
  const response=await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(`${instrument.label.replace(/[^A-Z0-9]/g,"")}USDT`)}&interval=1d&limit=400`,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`Binance HTTP ${response.status}`);const payload=await response.json();return ensureHistory((Array.isArray(payload)?payload:[]).flatMap((row):Point[]=>Array.isArray(row)?validPoint(new Date(Number(row[0])).toISOString(),num(row[1]),num(row[2]),num(row[3]),num(row[4]),num(row[5])):[]),"Binance");
}
async function cryptoCompareHistory(instrument:Instrument){
  const response=await fetch(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=${encodeURIComponent(instrument.label)}&tsym=USD&limit=400`,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`CryptoCompare HTTP ${response.status}`);const payload=await response.json() as {Response?:string;Data?:{Data?:Array<Record<string,unknown>>}};if(payload.Response==="Error")throw new Error("CryptoCompare sin activo");return ensureHistory((payload.Data?.Data??[]).flatMap(row=>validPoint(new Date(Number(row.time)*1000).toISOString(),num(row.open),num(row.high),num(row.low),num(row.close),num(row.volumeto))),"CryptoCompare");
}
async function coinGeckoHistory(instrument:Instrument){
  const response=await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(instrument.symbol)}/ohlc?vs_currency=usd&days=365`,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`CoinGecko OHLC HTTP ${response.status}`);const payload=await response.json();return ensureHistory((Array.isArray(payload)?payload:[]).flatMap((row):Point[]=>Array.isArray(row)&&row.length>=5?validPoint(new Date(Number(row[0])).toISOString(),num(row[1]),num(row[2]),num(row[3]),num(row[4]),null):[]),"CoinGecko");
}
async function cryptoHistory(instrument:Instrument){const errors:string[]=[];for(const [provider,loader] of [["Binance",binanceHistory],["CryptoCompare",cryptoCompareHistory],["CoinGecko",coinGeckoHistory]] as const){try{return{points:await loader(instrument),provider};}catch(error){errors.push(`${provider}: ${error instanceof Error?error.message:"fuente no disponible"}`);}}throw new Error(errors.join(" · "));}
async function coinGecko(instruments:Instrument[]=crypto){
  const url=new URL("https://api.coingecko.com/api/v3/coins/markets");url.searchParams.set("vs_currency","usd");url.searchParams.set("ids",instruments.map(i=>i.symbol).join(","));url.searchParams.set("price_change_percentage","24h");url.searchParams.set("precision","full");
  let byId=new Map<string,any>();try{const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});if(response.ok){const payload=await response.json();byId=new Map((Array.isArray(payload)?payload:[]).map(item=>[String(item.id),item]));}}catch{byId=new Map();}
  const results=await settleBatched(instruments,async(instrument):Promise<Quote>=>{const history=await cryptoHistory(instrument);const item=byId.get(instrument.symbol);const price=num(item?.current_price),change=num(item?.price_change_percentage_24h);const live=price!==null&&price>0?{price,change:change??pct(price,history.points.at(-1)?.value)??0,updatedAt:new Date(Date.parse(item?.last_updated??"")||Date.now()).toISOString(),provider:"CoinGecko"}:null;return buildQuote(instrument,history.points,history.provider,live,"USD","mercado cripto");});
  return results.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
}
async function tencentForex(instruments:Instrument[]=forex){
  let rows=new Map<string,string>();try{rows=parseLines(await tencent(instruments.map(i=>i.code!)));}catch{rows=new Map();}
  const histories=await settleBatched(instruments,i=>selectHistory(i,["Tencent","Eastmoney","TradingView","Dukascopy","Stooq"]),1);
  return instruments.flatMap((instrument,index)=>{if(histories[index].status!=="fulfilled")return[];const f=rows.get(instrument.code!.toLowerCase())?.split("~")??[];const price=num(f[3]),previous=num(f[4]);const live=price!==null&&price>0?{price,change:deriveChange(price,previous,num(f[13])),updatedAt:new Date().toISOString(),provider:"Tencent"}:null;const history=histories[index].value;return[buildQuote(instrument,history.points,history.provider,live,"","FOREX")];});
}
async function commoditySet(instruments:Instrument[]=commodities){
  let tencentRows=new Map<string,string>(),sinaRows=new Map<string,string>();
  try{tencentRows=parseLines(await tencent(instruments.map(i=>i.code!)));}catch{tencentRows=new Map();}
  try{sinaRows=parseLines(await providerText(`https://hq.sinajs.cn/list=${instruments.map(i=>i.code!).join(",")}`,"https://finance.sina.com.cn/"));}catch{sinaRows=new Map();}
  const results=await settleBatched(instruments,async(instrument):Promise<Quote>=>{const history=await selectHistory(instrument,["Tencent","Eastmoney","TradingView","Dukascopy","Stooq"]);let live:LiveQuote|null=null;for(const [provider,rows] of [["Tencent",tencentRows],["Sina",sinaRows]] as const){const f=rows.get(instrument.code!.toLowerCase())?.split(",")??[];const price=num(f[0]),change=num(f[1]);if(price!==null&&price>0){live={price,change:change??pct(price,history.points.at(-1)?.value)??0,updatedAt:f[12]&&f[6]?`${f[12]}T${f[6]}+08:00`:new Date().toISOString(),provider};break;}}return buildQuote(instrument,history.points,history.provider,live,"USD","materias primas");},1);
  return results.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
}
async function load(market:string){if(market==="acciones"||market==="etfs")return{requested:usMarkets[market].length,items:await usSet(market)};if(market==="europa")return{requested:european.length,items:await stooqSet(european)};if(market==="cripto")return{requested:crypto.length,items:await coinGecko()};if(market==="indices")return{requested:indices.length,items:await stooqSet(indices)};if(market==="forex")return{requested:forex.length,items:await tencentForex()};if(market==="materias")return{requested:commodities.length,items:await commoditySet()};if(market==="fondos")return{requested:funds.length,items:await usSet("etfs",funds)};if(market==="pequenas")return{requested:smallCaps.length,items:await stooqSet(smallCaps)};return{requested:0,items:[] as Quote[]};}

export default defineHandler(async(event)=>{const market=String(getQuery(event).market??"acciones").toLowerCase();try{const{requested,items}=await load(market);if(!requested)return{market,mode:"error",provider:"ninguno",items:[],requested:0,failures:0,error:"Mercado no válido"};const failures=requested-items.length;const providers=[...new Set(items.map(item=>item.priceProvider??item.exchange))];return{market,mode:items.length===requested?"real":items.length?"mixto":"sin-datos",provider:providers.join(" / ")||"fuente no disponible",updatedAt:new Date().toISOString(),requested,failures,items,error:items.length?null:"SIN DATOS — FUENTE NO DISPONIBLE"};}catch(error){return{market,mode:"sin-datos",provider:"fuentes alternativas no disponibles",updatedAt:new Date().toISOString(),requested:0,failures:0,items:[],error:`SIN DATOS — FUENTE NO DISPONIBLE${error instanceof Error?` · ${error.message}`:""}`};}});
