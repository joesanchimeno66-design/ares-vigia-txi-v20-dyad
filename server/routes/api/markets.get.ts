import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";

type Instrument = { symbol: string; label: string; name: string; stooq?: string; code?: string; currency?: string };
type Point = { time: string; value: number };
type Metrics = {
  returns: { intraday: number | null; week: number | null; month: number | null; sixMonths: number | null; year: number | null };
  ema9: number | null; ema21: number | null; rsi14: number | null; macd: number | null;
  macdSignal: number | null; macdHistogram: number | null; bollingerZ: number | null;
  volatility: number | null; trend: "alcista" | "bajista" | "lateral" | null; samples: number;
};
type Quote = {
  symbol: string; ticker: string; name: string; price: number; change: number;
  currency: string; exchange: string; updatedAt: string; chartSymbol: string;
  priceProvider: string; changeProvider: string; historyProvider: string;
  points: Point[]; metrics: Metrics;
};

const tuples = (rows: string[][], suffix = "us", currency = "USD"): Instrument[] => rows.map(([symbol, name]) => ({
  symbol, label: symbol, name, stooq: `${symbol.toLowerCase()}.${suffix}`, code: `us${symbol}`, currency,
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
  ]),
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
const european: Instrument[] = europeRows.map(([symbol,label,name,stooq,currency]) => ({ symbol,label,name,stooq,currency }));

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
].map(([symbol,name,code]) => ({ symbol,label:symbol,name,code:`wh${code}`,stooq:`${code.toLowerCase()}`,currency:"" }));

const commodities: Instrument[] = [
  ["GC","ORO","Oro"],["SI","PLATA","Plata"],["CL","WTI","Petróleo WTI"],["OIL","BRENT","Petróleo Brent"],["NG","GAS","Gas natural"],
  ["HG","COBRE","Cobre"],["W","TRIGO","Trigo"],["C","MAÍZ","Maíz"],["S","SOJA","Soja"],["KC","CAFÉ","Café"],["CC","CACAO","Cacao"],
].map(([code,label,name]) => ({ symbol:code,label,name,code:`hf_${code}`,stooq:`${code.toLowerCase()}.f`,currency:"USD" }));

const indices: Instrument[] = [
  ["^ibex","IBEX 35","IBEX 35"],["^spx","S&P 500","S&P 500"],["^ndq","NASDAQ","Nasdaq Composite"],["^dji","DOW","Dow Jones"],
  ["^stoxx50e","EURO50","Euro Stoxx 50"],["^dax","DAX","DAX"],["^cac","CAC40","CAC 40"],["^ukx","FTSE100","FTSE 100"],
  ["^nkx","NIKKEI","Nikkei 225"],["^hsi","HANGSENG","Hang Seng"],
].map(([stooq,label,name]) => ({ symbol:stooq,label,name,stooq,currency:"" }));

const funds = tuples([
  ["VFIAX","Vanguard 500 Index Admiral"],["VTSAX","Vanguard Total Market"],["VBTLX","Vanguard Total Bond Market"],["FXAIX","Fidelity 500 Index"],
  ["FSKAX","Fidelity Total Market"],["FXNAX","Fidelity U.S. Bond Index"],["SWPPX","Schwab S&P 500 Index"],["SWTSX","Schwab Total Market"],
  ["SWAGX","Schwab Aggregate Bond"],["VWELX","Vanguard Wellington"],["PRWCX","T. Rowe Price Capital Appreciation"],["DODGX","Dodge & Cox Stock"],
]);
const smallCaps = tuples([
  ["SOUN","SoundHound AI"],["BBAI","BigBear.ai"],["LUNR","Intuitive Machines"],["RKLB","Rocket Lab"],["IONQ","IonQ"],["RGTI","Rigetti Computing"],
]);

function num(value: unknown) { const parsed = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : null; }
function pct(current: number, previous?: number) { return previous && previous > 0 ? (current - previous) / previous * 100 : null; }
function ema(values: number[], period: number) { if (!values.length) return null; const a=2/(period+1); return values.slice(1).reduce((v,x)=>a*x+(1-a)*v,values[0]); }
function emaSeries(values: number[], period: number) { if (!values.length) return []; const a=2/(period+1); const out=[values[0]]; for(const x of values.slice(1)) out.push(a*x+(1-a)*out[out.length-1]); return out; }
function rsi(values: number[], period=14) { if(values.length<period+1)return null; let gains=0,losses=0; for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1];gains+=Math.max(d,0);losses+=Math.max(-d,0);} if(!losses)return 100; const rs=(gains/period)/(losses/period); return 100-100/(1+rs); }
function metrics(points: Point[], intraday: number | null): Metrics {
  const values=points.map(p=>p.value).filter(Number.isFinite); const last=values.at(-1) ?? 0;
  const at=(days:number)=>values.length>days?pct(last,values.at(-(days+1))):null;
  const e9=values.length>=9?ema(values.slice(-120),9):null,e21=values.length>=21?ema(values.slice(-120),21):null;
  let macd:null|number=null,signal:null|number=null,hist:null|number=null;
  if(values.length>=35){const e12=emaSeries(values,12),e26=emaSeries(values,26);const series=e12.map((v,i)=>v-e26[i]);macd=series.at(-1)??null;signal=ema(series.slice(-9),9);hist=macd!==null&&signal!==null?macd-signal:null;}
  let z:null|number=null;if(values.length>=20){const w=values.slice(-20),mean=w.reduce((a,b)=>a+b,0)/w.length;const sd=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length);z=sd?(last-mean)/sd:0;}
  const daily=values.slice(-31).flatMap((v,i,a)=>i&&a[i-1]>0?[(v-a[i-1])/a[i-1]]:[]);const vol=daily.length>=2?Math.sqrt(daily.reduce((a,b)=>a+b*b,0)/daily.length)*Math.sqrt(252)*100:null;
  const trend=e9!==null&&e21!==null?(e9>e21*1.002?"alcista":e9<e21*.998?"bajista":"lateral"):null;
  return {returns:{intraday,week:at(5),month:at(21),sixMonths:at(126),year:at(252)},ema9:e9,ema21:e21,rsi14:rsi(values),macd,macdSignal:signal,macdHistogram:hist,bollingerZ:z,volatility:vol,trend,samples:values.length};
}
function parseLines(text:string){const rows=new Map<string,string>();for(const raw of text.replace(/\r|\n/g,"").split(";")){if(!raw.includes("="))continue;const [left,...right]=raw.split("=");const key=left.trim().replace("var ","").replace("hq_str_","").replace("v_","").toLowerCase();const value=right.join("=").trim().replace(/^"|"$/g,"");if(key&&value)rows.set(key,value);}return rows;}
async function providerText(url:string,referer:string){const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 ARES-Vigia/13",Referer:referer,Accept:"*/*"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return new TextDecoder("gbk").decode(await response.arrayBuffer());}
async function tencent(codes:string[]){return providerText(`https://qt.gtimg.cn/q=${codes.join(",")}`,"https://gu.qq.com/");}
async function sina(codes:string[]){return providerText(`https://hq.sinajs.cn/list=${codes.join(",")}`,"https://finance.sina.com.cn/");}

type LiveQuote = { price: number; change: number; updatedAt: string; provider: string };
const deriveChange=(price:number,previous:number|null,reported:number|null)=>previous!==null&&previous>0?pct(price,previous)??0:reported??0;

async function eastmoneyQuote(instrument:Instrument):Promise<LiveQuote>{
  const suggest=new URL("https://searchapi.eastmoney.com/api/suggest/get");suggest.searchParams.set("input",instrument.symbol);suggest.searchParams.set("type","14");suggest.searchParams.set("token","D43BF722C8E33BDC906FB84D85E326E8");
  const searchResponse=await fetch(suggest,{headers:{Accept:"application/json",Referer:"https://quote.eastmoney.com/"},signal:AbortSignal.timeout(8000)});if(!searchResponse.ok)throw new Error(`Eastmoney búsqueda HTTP ${searchResponse.status}`);
  const search=await searchResponse.json() as {QuotationCodeTable?:{Data?:Array<{Code?:string;QuoteID?:string}>}};const candidates=search.QuotationCodeTable?.Data??[];const exact=candidates.find(item=>String(item.Code??"").toUpperCase()===instrument.symbol.toUpperCase());const secid=exact?.QuoteID;if(!secid)throw new Error("Eastmoney sin identificador");
  const response=await fetch(`https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}&fields=f43,f59,f60,f124,f170`,{headers:{Accept:"application/json",Referer:"https://quote.eastmoney.com/"},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`Eastmoney HTTP ${response.status}`);const payload=await response.json() as {data?:Record<string,unknown>};const data=payload.data;if(!data)throw new Error("Eastmoney sin cotización");const decimals=num(data.f59)??2,scale=10**decimals,priceRaw=num(data.f43),previousRaw=num(data.f60);if(priceRaw===null||priceRaw<=0)throw new Error("Eastmoney precio inválido");const price=priceRaw/scale,previous=previousRaw!==null?previousRaw/scale:null,reportedRaw=num(data.f170);const change=deriveChange(price,previous,reportedRaw!==null?reportedRaw/100:null);const epoch=num(data.f124);return{price,change,updatedAt:epoch&&epoch>0?new Date(epoch*1000).toISOString():new Date().toISOString(),provider:"Eastmoney"};
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

async function stooqHistory(symbol:string):Promise<Point[]>{
  const cached=historyCache.get(symbol);if(cached&&cached.expires>Date.now())return cached.points;
  const end=new Date(),start=new Date(Date.now()-380*86400000);const d=(x:Date)=>x.toISOString().slice(0,10).replace(/-/g,"");
  const url=`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${d(start)}&d2=${d(end)}&i=d`;
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 ARES-Vigia/13"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`Stooq HTTP ${response.status}`);
  const lines=(await response.text()).trim().split(/\r?\n/).slice(1);const points=lines.flatMap(line=>{const f=line.split(","),value=num(f[4]);return value!==null&&value>0&&/^\d{4}-\d{2}-\d{2}$/.test(f[0])?[{time:`${f[0]}T16:00:00Z`,value}]:[];});if(points.length)historyCache.set(symbol,{expires:Date.now()+5*60_000,points});return points;
}
async function preferredQuote(instrument:Instrument):Promise<Quote>{
  let history:Point[]=[];try{history=await stooqHistory(instrument.stooq??instrument.symbol);}catch{history=[];}
  try{const live=await eastmoneyQuote(instrument);const points=history.length?[...history.slice(0,-1),{time:live.updatedAt,value:live.price}]:[{time:live.updatedAt,value:live.price}];return{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price:live.price,change:live.change,currency:instrument.currency??"",exchange:"Eastmoney · cotización / Stooq · serie",updatedAt:live.updatedAt,chartSymbol:instrument.stooq??instrument.symbol,priceProvider:"Eastmoney",changeProvider:"Eastmoney (precio vs. cierre previo)",historyProvider:history.length?"Stooq":"Eastmoney (solo punto actual)",points,metrics:metrics(points,live.change)};}catch{if(history.length){const price=history.at(-1)!.value,change=pct(price,history.at(-2)?.value)??0,updatedAt=history.at(-1)!.time;return{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:instrument.currency??"",exchange:"Stooq · mercado público",updatedAt,chartSymbol:instrument.stooq??instrument.symbol,priceProvider:"Stooq",changeProvider:"Stooq (cierre vs. cierre previo)",historyProvider:"Stooq",points:history,metrics:metrics(history,change)};}throw new Error("SIN DATOS — FUENTE NO DISPONIBLE");}
}
async function stooqSet(instruments:Instrument[]){const results=await settleBatched(instruments,preferredQuote);return results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);}
async function tencentDailyHistory(instrument:Instrument):Promise<Point[]>{
  if(!instrument.code)throw new Error("Tencent sin código");
  const cacheKey=`tencent:${instrument.code.toLowerCase()}`,cached=historyCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return cached.points;
  const response=await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(`${instrument.code},day,,,420,qfq`)}`,{headers:{Accept:"application/json",Referer:"https://gu.qq.com/","User-Agent":"Mozilla/5.0 ARES-Vigia/13"},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`Tencent histórico HTTP ${response.status}`);
  const payload=await response.json() as {data?:Record<string,Record<string,unknown>>};
  const bucket=payload.data?.[instrument.code]??payload.data?.[instrument.code.toLowerCase()];
  const rows=(bucket?.day??bucket?.qfqday) as unknown;
  const points=(Array.isArray(rows)?rows:[]).flatMap((row):Point[]=>{if(!Array.isArray(row))return[];const value=num(row[2]);return value!==null&&value>0&&/^\d{4}-\d{2}-\d{2}$/.test(String(row[0]??""))?[{time:`${row[0]}T16:00:00Z`,value}]:[];});
  if(points.length<2)throw new Error("Tencent histórico insuficiente");
  historyCache.set(cacheKey,{expires:Date.now()+5*60_000,points});
  return points;
}
async function usSet(market:"acciones"|"etfs", instruments:Instrument[]=usMarkets[market]){
  let tencentRows=new Map<string,string>(),sinaRows=new Map<string,string>();
  try{tencentRows=parseLines(await tencent(instruments.map(i=>i.code!)));}catch{tencentRows=new Map();}
  try{sinaRows=parseLines(await sina(instruments.map(i=>`gb_${i.symbol.toLowerCase()}`)));}catch{sinaRows=new Map();}
  const results=await settleBatched(instruments,async(instrument):Promise<Quote>=>{
    let history:Point[]=[],historyProvider="";
    if(market==="etfs"){try{history=await tencentDailyHistory(instrument);historyProvider="Tencent";}catch{try{history=await stooqHistory(instrument.stooq!);historyProvider="Stooq";}catch{history=[];}}}
    else{try{history=await stooqHistory(instrument.stooq!);historyProvider="Stooq";}catch{history=[];}}
    const tf=tencentRows.get(instrument.code!.toLowerCase())?.split("~")??[];const tPrice=num(tf[3]),tPrevious=num(tf[4]);
    const sf=sinaRows.get(`gb_${instrument.symbol.toLowerCase()}`)?.split(",")??[];const sPrice=num(sf[1]);
    let live:LiveQuote|null=null;
    if(tPrice!==null&&tPrice>0){const raw=tf[30];live={price:tPrice,change:deriveChange(tPrice,tPrevious,num(tf[32])),updatedAt:/^\d{14}$/.test(raw??"")?`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(8,10)}:${raw.slice(10,12)}:${raw.slice(12,14)}-04:00`:new Date().toISOString(),provider:"Tencent"};}
    else if(sPrice!==null&&sPrice>0){live={price:sPrice,change:deriveChange(sPrice,null,num(sf[2])),updatedAt:sf[3]&&Number.isFinite(Date.parse(sf[3]))?new Date(sf[3]).toISOString():new Date().toISOString(),provider:"Sina"};}
    else{try{live=await eastmoneyQuote(instrument);}catch{live=null;}}
    if(!live){if(history.length){const price=history.at(-1)!.value,change=pct(price,history.at(-2)?.value)??0,updatedAt=history.at(-1)!.time;return{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"USD",exchange:`${historyProvider} · mercado público`,updatedAt,chartSymbol:instrument.stooq!,priceProvider:historyProvider,changeProvider:`${historyProvider} (cierre vs. cierre previo)`,historyProvider,points:history,metrics:metrics(history,change)};}throw new Error("SIN DATOS — FUENTE NO DISPONIBLE");}
    const points=history.length?[...history.slice(0,-1),{time:live.updatedAt,value:live.price}]:[{time:live.updatedAt,value:live.price}];return{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price:live.price,change:live.change,currency:"USD",exchange:`${live.provider} · mercado USA`,updatedAt:live.updatedAt,chartSymbol:instrument.stooq!,priceProvider:live.provider,changeProvider:`${live.provider} (precio vs. cierre previo)`,historyProvider:history.length?historyProvider:`${live.provider} (solo punto actual)`,points,metrics:metrics(points,live.change)};
  });
  return results.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
}
async function coinGecko(){
  const url=new URL("https://api.coingecko.com/api/v3/coins/markets");url.searchParams.set("vs_currency","usd");url.searchParams.set("ids",crypto.map(i=>i.symbol).join(","));url.searchParams.set("sparkline","true");url.searchParams.set("price_change_percentage","1h,24h,7d,30d,1y");url.searchParams.set("precision","full");
  const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`CoinGecko HTTP ${response.status}`);const payload=await response.json();const byId=new Map((Array.isArray(payload)?payload:[]).map(i=>[String(i.id),i]));
  return crypto.flatMap(instrument=>{const item=byId.get(instrument.symbol);const price=num(item?.current_price),change=num(item?.price_change_percentage_24h);if(price===null||price<=0||change===null)return[];const raw:Array<number>=Array.isArray(item?.sparkline_in_7d?.price)?item.sparkline_in_7d.price:[];const end=Date.parse(item?.last_updated??"")||Date.now(),step=raw.length>1?7*86400000/(raw.length-1):0;const points=raw.flatMap((value,index)=>Number.isFinite(value)?[{time:new Date(end-(raw.length-1-index)*step).toISOString(),value}]:[]).slice(-168);const m=metrics(points,change);m.returns.week=num(item?.price_change_percentage_7d_in_currency);m.returns.month=num(item?.price_change_percentage_30d_in_currency);m.returns.year=num(item?.price_change_percentage_1y_in_currency);return[{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"USD",exchange:"CoinGecko · mercado cripto",updatedAt:new Date(end).toISOString(),chartSymbol:instrument.symbol,priceProvider:"CoinGecko",changeProvider:"CoinGecko (24 h)",historyProvider:"CoinGecko (sparkline 7 días)",points:points.length?points:[{time:new Date(end).toISOString(),value:price}],metrics:m}];});
}
async function tencentForex(){const rows=parseLines(await tencent(forex.map(i=>i.code!)));const histories=await settleBatched(forex,i=>stooqHistory(i.stooq!));return forex.flatMap((instrument,index)=>{const f=rows.get(instrument.code!.toLowerCase())?.split("~")??[];const price=num(f[3]),previous=num(f[4]);if(price===null||price<=0)return[];const points=histories[index].status==="fulfilled"?histories[index].value:[];const change=deriveChange(price,previous,num(f[13]));const updatedAt=new Date().toISOString();const series=points.length?[...points.slice(0,-1),{time:updatedAt,value:price}]:[{time:updatedAt,value:price}];return[{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"",exchange:"Tencent Finance · FOREX",updatedAt,chartSymbol:instrument.stooq!,priceProvider:"Tencent",changeProvider:"Tencent (precio vs. cierre previo)",historyProvider:points.length?"Stooq":"Tencent (solo punto actual)",points:series,metrics:metrics(series,change)}];});}
async function commoditySet(){
  const histories=await settleBatched(commodities,item=>stooqHistory(item.stooq!));
  for(const host of ["Tencent","Sina"] as const){
    try{
      const text=host==="Tencent"?await tencent(commodities.map(i=>i.code!)):await providerText(`https://hq.sinajs.cn/list=${commodities.map(i=>i.code!).join(",")}`,"https://finance.sina.com.cn/");
      const rows=parseLines(text);
      const items=commodities.flatMap((instrument,index)=>{
        const f=rows.get(instrument.code!.toLowerCase())?.split(",")??[];const price=num(f[0]),change=num(f[1]);if(price===null||price<=0||change===null)return[];
        const updatedAt=f[12]&&f[6]?`${f[12]}T${f[6]}+08:00`:new Date().toISOString();const history=histories[index].status==="fulfilled"?histories[index].value:[];
        const points=history.length?[...history.slice(0,-1),{time:updatedAt,value:price}]:[{time:updatedAt,value:price}];
        return[{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"USD",exchange:`${host} Finance · materias primas`,updatedAt,chartSymbol:instrument.stooq!,priceProvider:host,changeProvider:`${host} (variación publicada)`,historyProvider:history.length?"Stooq":`${host} (solo punto actual)`,points,metrics:metrics(points,change)}];
      });
      if(items.length)return items;
    }catch{continue;}
  }
  return[];
}
async function load(market:string){if(market==="acciones"||market==="etfs")return{requested:usMarkets[market].length,items:await usSet(market)};if(market==="europa")return{requested:european.length,items:await stooqSet(european)};if(market==="cripto")return{requested:crypto.length,items:await coinGecko()};if(market==="indices")return{requested:indices.length,items:await stooqSet(indices)};if(market==="forex")return{requested:forex.length,items:await tencentForex()};if(market==="materias")return{requested:commodities.length,items:await commoditySet()};if(market==="fondos")return{requested:funds.length,items:await usSet("etfs",funds)};if(market==="pequenas")return{requested:smallCaps.length,items:await stooqSet(smallCaps)};return{requested:0,items:[] as Quote[]};}

export default defineHandler(async(event)=>{const market=String(getQuery(event).market??"acciones").toLowerCase();try{const{requested,items}=await load(market);if(!requested)return{market,mode:"error",provider:"ninguno",items:[],requested:0,failures:0,error:"Mercado no válido"};const failures=requested-items.length;const providers=[...new Set(items.map(item=>item.priceProvider??item.exchange))];return{market,mode:items.length===requested?"real":items.length?"mixto":"sin-datos",provider:providers.join(" / ")||"fuente no disponible",updatedAt:new Date().toISOString(),requested,failures,items,error:items.length?null:"SIN DATOS — FUENTE NO DISPONIBLE"};}catch(error){return{market,mode:"sin-datos",provider:"fuentes alternativas no disponibles",updatedAt:new Date().toISOString(),requested:0,failures:0,items:[],error:`SIN DATOS — FUENTE NO DISPONIBLE${error instanceof Error?` · ${error.message}`:""}`};}});
