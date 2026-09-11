import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";

type Instrument = { symbol: string; label: string; name: string; stooq?: string; code?: string; currency?: string };
type Point = { time: string; value: number };
type Metrics = {
  returns: { intraday: number | null; week: number | null; month: number | null; sixMonths: number | null; year: number | null };
  ema9: number | null; ema21: number | null; rsi14: number | null; macd: number | null;
  macdSignal: number | null; macdHistogram: number | null; bollingerZ: number | null;
  volatility: number | null; trend: "alcista" | "bajista" | "lateral"; samples: number;
};
type Quote = {
  symbol: string; ticker: string; name: string; price: number; change: number;
  currency: string; exchange: string; updatedAt: string; points: Point[]; metrics: Metrics;
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
  ]),
  etfs: tuples([
    ["SPY","SPDR S&P 500 ETF"],["QQQ","Invesco QQQ"],["VOO","Vanguard S&P 500"],["VTI","Vanguard Total Market"],
    ["IWM","iShares Russell 2000"],["DIA","SPDR Dow Jones"],["VEA","Vanguard Developed Markets"],["VWO","Vanguard Emerging Markets"],
    ["EFA","iShares MSCI EAFE"],["EEM","iShares Emerging Markets"],["XLK","Technology Select Sector"],["XLF","Financial Select Sector"],
    ["XLE","Energy Select Sector"],["XLV","Health Care Select Sector"],["GLD","SPDR Gold Shares"],["SLV","iShares Silver Trust"],
    ["TLT","iShares 20+ Year Treasury"],["HYG","iShares High Yield Bond"],["ARKK","ARK Innovation"],["IBIT","iShares Bitcoin Trust"],
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
];
const european: Instrument[] = europeRows.map(([symbol,label,name,stooq,currency]) => ({ symbol,label,name,stooq,currency }));

const crypto: Instrument[] = [
  ["bitcoin","BTC","Bitcoin"],["ethereum","ETH","Ethereum"],["binancecoin","BNB","BNB"],["solana","SOL","Solana"],["ripple","XRP","XRP"],
  ["cardano","ADA","Cardano"],["dogecoin","DOGE","Dogecoin"],["tron","TRX","TRON"],["the-open-network","TON","Toncoin"],["avalanche-2","AVAX","Avalanche"],
  ["polkadot","DOT","Polkadot"],["chainlink","LINK","Chainlink"],["litecoin","LTC","Litecoin"],["shiba-inu","SHIB","Shiba Inu"],["uniswap","UNI","Uniswap"],
  ["cosmos","ATOM","Cosmos"],["stellar","XLM","Stellar"],["near","NEAR","NEAR"],["ethereum-classic","ETC","Ethereum Classic"],["hyperliquid","HYPE","Hyperliquid"],
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
  const at=(days:number)=>pct(last,values.at(-(days+1))); const e9=ema(values.slice(-120),9),e21=ema(values.slice(-120),21);
  let macd:null|number=null,signal:null|number=null,hist:null|number=null;
  if(values.length>=26){const e12=emaSeries(values,12),e26=emaSeries(values,26);const series=e12.map((v,i)=>v-e26[i]);macd=series.at(-1)??null;signal=ema(series,9);hist=macd!==null&&signal!==null?macd-signal:null;}
  let z:null|number=null;if(values.length>=20){const w=values.slice(-20),mean=w.reduce((a,b)=>a+b,0)/w.length;const sd=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length);z=sd?(last-mean)/sd:0;}
  const daily=values.slice(-31).flatMap((v,i,a)=>i&&a[i-1]>0?[(v-a[i-1])/a[i-1]]:[]);const vol=daily.length?Math.sqrt(daily.reduce((a,b)=>a+b*b,0)/daily.length)*Math.sqrt(252)*100:null;
  const trend=e9!==null&&e21!==null?(e9>e21*1.002?"alcista":e9<e21*.998?"bajista":"lateral"):"lateral";
  return {returns:{intraday,week:at(5),month:at(21),sixMonths:at(126),year:at(252)},ema9:e9,ema21:e21,rsi14:rsi(values),macd,macdSignal:signal,macdHistogram:hist,bollingerZ:z,volatility:vol,trend,samples:values.length};
}
function parseLines(text:string){const rows=new Map<string,string>();for(const raw of text.replace(/\r|\n/g,"").split(";")){if(!raw.includes("="))continue;const [left,...right]=raw.split("=");const key=left.trim().replace("var ","").replace("hq_str_","").replace("v_","").toLowerCase();const value=right.join("=").trim().replace(/^"|"$/g,"");if(key&&value)rows.set(key,value);}return rows;}
async function providerText(url:string,referer:string){const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 ARES-Vigia/13",Referer:referer,Accept:"*/*"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return new TextDecoder("gbk").decode(await response.arrayBuffer());}
async function tencent(codes:string[]){return providerText(`https://qt.gtimg.cn/q=${codes.join(",")}`,"https://gu.qq.com/");}

async function stooqHistory(symbol:string):Promise<Point[]>{
  const end=new Date(),start=new Date(Date.now()-380*86400000);const d=(x:Date)=>x.toISOString().slice(0,10).replace(/-/g,"");
  const url=`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${d(start)}&d2=${d(end)}&i=d`;
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 ARES-Vigia/13"},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`Stooq HTTP ${response.status}`);
  const lines=(await response.text()).trim().split(/\r?\n/).slice(1);return lines.flatMap(line=>{const f=line.split(","),value=num(f[4]);return value!==null&&value>0&&/^\d{4}-\d{2}-\d{2}$/.test(f[0])?[{time:`${f[0]}T16:00:00Z`,value}]:[];});
}
async function stooqQuote(instrument:Instrument):Promise<Quote>{
  const points=await stooqHistory(instrument.stooq??instrument.symbol);if(!points.length)throw new Error("Stooq sin histórico");const price=points.at(-1)!.value;const change=pct(price,points.at(-2)?.value)??0;const updatedAt=points.at(-1)!.time;
  return {symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:instrument.currency??"",exchange:"Stooq · mercado público",updatedAt,points,metrics:metrics(points,change)};
}
async function stooqSet(instruments:Instrument[]){const results=await Promise.allSettled(instruments.map(stooqQuote));return results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);}
async function usSet(market:"acciones"|"etfs"){
  const instruments=usMarkets[market];let rows=new Map<string,string>();try{rows=parseLines(await tencent(instruments.map(i=>i.code!)));}catch{rows=new Map();}
  const histories=await Promise.allSettled(instruments.map(i=>stooqHistory(i.stooq!)));
  return instruments.flatMap((instrument,index)=>{const f=rows.get(instrument.code!.toLowerCase())?.split("~")??[];const livePrice=num(f[3]),liveChange=num(f[32]);const history=histories[index].status==="fulfilled"?histories[index].value:[];const price=livePrice??history.at(-1)?.value;if(!price)return[];const change=liveChange??pct(price,history.at(-2)?.value)??0;const raw=f[30];const updatedAt=/^\d{14}$/.test(raw??"")?`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(8,10)}:${raw.slice(10,12)}:${raw.slice(12,14)}-04:00`:history.at(-1)?.time??new Date().toISOString();const points=history.length?[...history.slice(0,-1),{time:updatedAt,value:price}]:[{time:updatedAt,value:price}];const exchange=livePrice!==null?"Tencent Finance · mercado USA":"Stooq · mercado público";return[{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"USD",exchange,updatedAt,points,metrics:metrics(points,change)}];});
}
async function coinGecko(){
  const url=new URL("https://api.coingecko.com/api/v3/coins/markets");url.searchParams.set("vs_currency","usd");url.searchParams.set("ids",crypto.map(i=>i.symbol).join(","));url.searchParams.set("sparkline","true");url.searchParams.set("price_change_percentage","1h,24h,7d,30d,1y");url.searchParams.set("precision","full");
  const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`CoinGecko HTTP ${response.status}`);const payload=await response.json();const byId=new Map((Array.isArray(payload)?payload:[]).map(i=>[String(i.id),i]));
  return crypto.flatMap(instrument=>{const item=byId.get(instrument.symbol);const price=num(item?.current_price),change=num(item?.price_change_percentage_24h);if(price===null||price<=0||change===null)return[];const raw:Array<number>=Array.isArray(item?.sparkline_in_7d?.price)?item.sparkline_in_7d.price:[];const end=Date.parse(item?.last_updated??"")||Date.now(),step=raw.length>1?7*86400000/(raw.length-1):0;const points=raw.flatMap((value,index)=>Number.isFinite(value)?[{time:new Date(end-(raw.length-1-index)*step).toISOString(),value}]:[]).slice(-168);const m=metrics(points,change);m.returns.week=num(item?.price_change_percentage_7d_in_currency);m.returns.month=num(item?.price_change_percentage_30d_in_currency);m.returns.year=num(item?.price_change_percentage_1y_in_currency);return[{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"USD",exchange:"CoinGecko · mercado cripto",updatedAt:new Date(end).toISOString(),points:points.length?points:[{time:new Date(end).toISOString(),value:price}],metrics:m}];});
}
async function tencentForex(){const rows=parseLines(await tencent(forex.map(i=>i.code!)));const histories=await Promise.allSettled(forex.map(i=>stooqHistory(i.stooq!)));return forex.flatMap((instrument,index)=>{const f=rows.get(instrument.code!.toLowerCase())?.split("~")??[];const price=num(f[3]);if(price===null||price<=0)return[];const points=histories[index].status==="fulfilled"?histories[index].value:[];const change=num(f[13])??pct(price,points.at(-2)?.value)??0;const updatedAt=new Date().toISOString();const series=points.length?[...points.slice(0,-1),{time:updatedAt,value:price}]:[{time:updatedAt,value:price}];return[{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"",exchange:"Tencent Finance · FOREX",updatedAt,points:series,metrics:metrics(series,change)}];});}
async function commoditySet(){
  const histories=await Promise.allSettled(commodities.map(item=>stooqHistory(item.stooq!)));
  for(const host of ["Tencent","Sina"] as const){
    try{
      const text=host==="Tencent"?await tencent(commodities.map(i=>i.code!)):await providerText(`https://hq.sinajs.cn/list=${commodities.map(i=>i.code!).join(",")}`,"https://finance.sina.com.cn/");
      const rows=parseLines(text);
      const items=commodities.flatMap((instrument,index)=>{
        const f=rows.get(instrument.code!.toLowerCase())?.split(",")??[];const price=num(f[0]),change=num(f[1]);if(price===null||price<=0||change===null)return[];
        const updatedAt=f[12]&&f[6]?`${f[12]}T${f[6]}+08:00`:new Date().toISOString();const history=histories[index].status==="fulfilled"?histories[index].value:[];
        const points=history.length?[...history.slice(0,-1),{time:updatedAt,value:price}]:[{time:updatedAt,value:price}];
        return[{symbol:instrument.label,ticker:instrument.symbol,name:instrument.name,price,change,currency:"USD",exchange:`${host} Finance · materias primas`,updatedAt,points,metrics:metrics(points,change)}];
      });
      if(items.length)return items;
    }catch{continue;}
  }
  return[];
}
async function load(market:string){if(market==="acciones"||market==="etfs")return{requested:usMarkets[market].length,items:await usSet(market),providers:["Tencent Finance","Stooq"]};if(market==="europa")return{requested:european.length,items:await stooqSet(european),providers:["Stooq"]};if(market==="cripto")return{requested:crypto.length,items:await coinGecko(),providers:["CoinGecko"]};if(market==="indices")return{requested:indices.length,items:await stooqSet(indices),providers:["Stooq"]};if(market==="forex")return{requested:forex.length,items:await tencentForex(),providers:["Tencent Finance","Stooq"]};if(market==="materias")return{requested:commodities.length,items:await commoditySet(),providers:["Tencent Finance","Sina Finance"]};if(market==="fondos")return{requested:funds.length,items:await stooqSet(funds),providers:["Stooq"]};if(market==="pequenas")return{requested:smallCaps.length,items:await stooqSet(smallCaps),providers:["Stooq"]};return{requested:0,items:[] as Quote[],providers:[] as string[]};}

export default defineHandler(async(event)=>{const market=String(getQuery(event).market??"acciones").toLowerCase();try{const{requested,items,providers}=await load(market);if(!requested)return{market,mode:"error",provider:"ninguno",items:[],requested:0,failures:0,error:"Mercado no válido"};const failures=requested-items.length;return{market,mode:items.length===requested?"real":items.length?"mixto":"sin-datos",provider:providers.join(" / "),updatedAt:new Date().toISOString(),requested,failures,items,error:items.length?null:"SIN DATOS – FUENTE NO DISPONIBLE"};}catch(error){return{market,mode:"sin-datos",provider:"fuentes alternativas no disponibles",updatedAt:new Date().toISOString(),requested:0,failures:0,items:[],error:`SIN DATOS – FUENTE NO DISPONIBLE${error instanceof Error?` · ${error.message}`:""}`};}});
