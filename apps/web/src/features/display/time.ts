import { useEffect, useState } from "react";

/** Durée en `m:ss` (ou `h:mm:ss`), préfixée de `-` au-delà du temps prévu. */
export const formatDuration = (ms: number) => {
  const total = Math.ceil(Math.abs(ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const sign = ms < 0 ? "-" : "";
  const paddedSeconds = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${sign}${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`
    : `${sign}${minutes}:${paddedSeconds}`;
};

export const formatClock = (now: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(now);

/** Horloge locale rafraîchie à intervalle régulier (horloge et minuteur des écrans). */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
};
