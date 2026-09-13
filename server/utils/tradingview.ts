import WebSocket from "ws";

export type TradingViewCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

const frame = (method: string, params: unknown[]) => {
  const payload = JSON.stringify({ m: method, p: params });
  return `~m~${payload.length}~m~${payload}`;
};

function unpack(message: string) {
  const payloads: string[] = [];
  let cursor = 0;
  while (message.startsWith("~m~", cursor)) {
    const lengthEnd = message.indexOf("~m~", cursor + 3);
    if (lengthEnd < 0) break;
    const length = Number(message.slice(cursor + 3, lengthEnd));
    if (!Number.isFinite(length)) break;
    const start = lengthEnd + 3;
    payloads.push(message.slice(start, start + length));
    cursor = start + length;
  }
  return payloads;
}

export function tradingViewDaily(symbol: string, limit = 420): Promise<TradingViewCandle[]> {
  const chartSession = `cs_${Math.random().toString(36).slice(2, 14)}`;
  const candles = new Map<number, TradingViewCandle>();

  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://data.tradingview.com/socket.io/websocket?from=symbols", {
      headers: {
        Origin: "https://www.tradingview.com",
        "User-Agent": "Mozilla/5.0 ARES-Vigia/22",
      },
    });
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      if (error) reject(error);
      else resolve([...candles.entries()].sort((a, b) => a[0] - b[0]).map(([, candle]) => candle));
    };
    const timer = setTimeout(() => finish(new Error("TradingView timeout")), 15_000);

    socket.on("open", () => {
      socket.send(frame("set_auth_token", ["unauthorized_user_token"]));
      socket.send(frame("chart_create_session", [chartSession, ""]));
      socket.send(frame("resolve_symbol", [chartSession, "symbol_1", `={\"symbol\":\"${symbol}\",\"adjustment\":\"splits\",\"session\":\"regular\"}`]));
      socket.send(frame("create_series", [chartSession, "s1", "s1", "symbol_1", "1D", limit, ""]));
    });

    socket.on("message", raw => {
      for (const payload of unpack(String(raw))) {
        if (payload.startsWith("~h~")) {
          socket.send(`~m~${payload.length}~m~${payload}`);
          continue;
        }
        let message: { m?: string; p?: any[] };
        try { message = JSON.parse(payload); } catch { continue; }
        if (["critical_error", "series_error", "symbol_error"].includes(message.m ?? "")) {
          finish(new Error(`TradingView rechazó ${symbol}`));
          return;
        }
        if (message.m === "timescale_update") {
          const rows = message.p?.[1]?.s1?.s;
          if (!Array.isArray(rows)) continue;
          for (const row of rows) {
            const values = row?.v;
            if (!Array.isArray(values) || values.length < 5) continue;
            const index = Number(row?.i);
            const [epoch, open, high, low, close, volume] = values.map(Number);
            if (![index, epoch, open, high, low, close].every(Number.isFinite)) continue;
            if (Math.min(open, high, low, close) <= 0 || high < Math.max(open, close) || low > Math.min(open, close)) continue;
            candles.set(index, {
              time: new Date(epoch * 1000).toISOString(),
              open,
              high,
              low,
              close,
              volume: Number.isFinite(volume) && volume >= 0 ? volume : null,
            });
          }
        }
        if (message.m === "series_completed") {
          finish();
          return;
        }
      }
    });
    socket.on("error", error => finish(error));
    socket.on("close", () => {
      if (!finished) finish(new Error("TradingView cerró la conexión antes de completar la serie"));
    });
  });
}
