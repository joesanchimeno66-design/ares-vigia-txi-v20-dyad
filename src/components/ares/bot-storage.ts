export type BotMode = "corto" | "medio" | "tendencia";
export type BotRisk = "BAJO" | "MEDIO" | "ALTO";

export type BotConfiguration = {
  mode: BotMode;
  assetId: string;
  period: string;
  objective: string;
  risk: BotRisk;
  savedAt: string | null;
};

export type BotConfigurationState = Record<BotMode, BotConfiguration>;

const storageKey = "ares-bots-vigia-v1";

export const defaultBotConfigurations: BotConfigurationState = {
  corto: { mode: "corto", assetId: "acciones:AAPL", period: "30 minutos", objective: "Capturar impulso rápido", risk: "ALTO", savedAt: null },
  medio: { mode: "medio", assetId: "etfs:SPY", period: "4 horas", objective: "Movimiento de varios días", risk: "MEDIO", savedAt: null },
  tendencia: { mode: "tendencia", assetId: "indices:^spx", period: "1 día", objective: "Seguir la tendencia principal", risk: "BAJO", savedAt: null },
};

function cloneDefaults(): BotConfigurationState {
  return {
    corto: { ...defaultBotConfigurations.corto },
    medio: { ...defaultBotConfigurations.medio },
    tendencia: { ...defaultBotConfigurations.tendencia },
  };
}

export const botConfigurationRepository = {
  load(): BotConfigurationState {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return cloneDefaults();
      const parsed = JSON.parse(raw) as Partial<BotConfigurationState>;
      return {
        corto: { ...defaultBotConfigurations.corto, ...parsed.corto, mode: "corto" },
        medio: { ...defaultBotConfigurations.medio, ...parsed.medio, mode: "medio" },
        tendencia: { ...defaultBotConfigurations.tendencia, ...parsed.tendencia, mode: "tendencia" },
      };
    } catch {
      return cloneDefaults();
    }
  },
  save(state: BotConfigurationState) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  },
  reset() {
    localStorage.removeItem(storageKey);
    return cloneDefaults();
  },
};
