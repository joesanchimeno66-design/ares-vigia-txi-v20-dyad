import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler(() => {
  const config = useRuntimeConfig();
  const token = String(config.telegramBotToken ?? "").trim();
  const chatId = String(config.telegramChatId ?? "").trim();
  return { configured: Boolean(token && chatId), tokenConfigured: Boolean(token), chatConfigured: Boolean(chatId) };
});
