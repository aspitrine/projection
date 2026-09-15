import { getLocale } from "@/paraglide/runtime";

/** « 2026-09-21 » → « dimanche 21 septembre 2026 » (date calendaire, sans fuseau). */
export const formatProjectDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)),
  );
};
