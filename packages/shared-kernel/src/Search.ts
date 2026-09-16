/** Comparaison de texte pour la recherche : sans casse ni accents. */
export const normalizeForSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const matchesSearch = (haystack: string, needle: string) =>
  normalizeForSearch(haystack).includes(normalizeForSearch(needle));

/**
 * Extrait du texte d'origine autour de la première occurrence, mots trouvés encadrés
 * par « ». Le texte garde ses accents, même si la recherche est écrite sans.
 */
export const excerptAround = (source: string, query: string, radius = 40): string | null => {
  const trimmed = query.trim();
  if (source === "" || trimmed === "") return null;

  const index = normalizeForSearch(source).indexOf(normalizeForSearch(trimmed));
  if (index === -1) return null;

  const end = index + trimmed.length;
  const start = Math.max(0, index - radius);
  const stop = Math.min(source.length, end + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = stop < source.length ? "…" : "";
  return `${prefix}${source.slice(start, index).trimStart()}«${source.slice(index, end)}»${source.slice(end, stop).trimEnd()}${suffix}`;
};
