import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";
import { createError, readBody } from "nitro/h3";

export default defineHandler(async (event) => {
  const config = useRuntimeConfig();
  const token = String(config.telegramBotToken ?? "").trim();
  const configuredChat = String(config.telegramChatId ?? "").trim();
  if (!token || !configuredChat) throw createError({ statusCode: 503, statusMessage: "Telegram no configurado en el servidor" });
  const body = await readBody<{ text?: string }>(event);
  const text = String(body?.text ?? "").trim();
  if (!text || text.length > 1500) throw createError({ statusCode: 400, statusMessage: "Mensaje no válido" });
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: configuredChat, text }), signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json() as { ok?: boolean; description?: string };
  if (!response.ok || !result.ok) throw createError({ statusCode: 502, statusMessage: result.description ?? "Telegram no aceptó el mensaje" });
  return { ok: true };
});
