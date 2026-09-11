import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapEntity = { roles?: string[]; vcardArray?: [string, unknown[]] };
type RdapResponse = { handle?: string; status?: string[]; events?: RdapEvent[]; entities?: RdapEntity[]; nameservers?: { ldhName?: string }[] };

function domainFromInput(input: string) {
  const value = input.trim();
  if (!value) return "";
  const hostname = new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
    throw createError({ statusCode: 400, statusMessage: "Dominio no válido" });
  }
  return hostname;
}

function registrarName(entities: RdapEntity[] = []) {
  const registrar = entities.find((entity) => entity.roles?.includes("registrar"));
  const fields = registrar?.vcardArray?.[1];
  if (!Array.isArray(fields)) return null;
  const fn = fields.find((field) => Array.isArray(field) && field[0] === "fn");
  return Array.isArray(fn) ? String(fn[3] ?? "") || null : null;
}

export default defineHandler(async (event) => {
  const body = await readBody<{ website?: string; entity?: string }>(event);
  const domain = domainFromInput(body?.website ?? "");
  if (!domain) return {
    checkedAt: new Date().toISOString(), domain: null, available: false,
    detail: "Añade un dominio para realizar la verificación registral.", warnings: [],
    officialLinks: { cnmvEntities: "https://www.cnmv.es/portal/consultas/BusquedaPorEntidad", cnmvWarnings: "https://internet.cnmv.es/portal/BusquedaAdvertencias?lang=es", icann: "https://lookup.icann.org/en" },
  };

  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { Accept: "application/rdap+json, application/json" }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`RDAP HTTP ${response.status}`);
    const data = await response.json() as RdapResponse;
    const registeredAt = data.events?.find((item) => item.eventAction === "registration")?.eventDate ?? null;
    const expiresAt = data.events?.find((item) => item.eventAction === "expiration")?.eventDate ?? null;
    const ageDays = registeredAt ? Math.max(0, Math.floor((Date.now() - Date.parse(registeredAt)) / 86_400_000)) : null;
    const warnings: string[] = [];
    if (ageDays !== null && ageDays < 30) warnings.push(`Dominio registrado hace solo ${ageDays} días`);
    else if (ageDays !== null && ageDays < 180) warnings.push(`Dominio reciente: ${ageDays} días de antigüedad`);
    if (data.status?.some((status) => /hold|redemption|pending delete/i.test(status))) warnings.push("El registro presenta un estado restrictivo");
    return {
      checkedAt: new Date().toISOString(), domain, available: true, registeredAt, expiresAt, ageDays,
      registrar: registrarName(data.entities), statuses: data.status ?? [], nameservers: (data.nameservers ?? []).map((item) => item.ldhName).filter(Boolean), warnings,
      source: "RDAP oficial del registro · acceso mediante rdap.org",
      officialLinks: { cnmvEntities: "https://www.cnmv.es/portal/consultas/BusquedaPorEntidad", cnmvWarnings: "https://internet.cnmv.es/portal/BusquedaAdvertencias?lang=es", icann: `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(domain)}` },
    };
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(), domain, available: false,
      detail: `Registro RDAP no disponible${error instanceof Error ? ` · ${error.message}` : ""}`, warnings: [],
      officialLinks: { cnmvEntities: "https://www.cnmv.es/portal/consultas/BusquedaPorEntidad", cnmvWarnings: "https://internet.cnmv.es/portal/BusquedaAdvertencias?lang=es", icann: `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(domain)}` },
    };
  }
});
