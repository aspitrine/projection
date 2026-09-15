/** Slug unique dérivé du nom : « Église Saint-Jean » → « eglise-saint-jean-4f2a9c ». */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = crypto.randomUUID().slice(0, 6);
  return base ? `${base}-${suffix}` : suffix;
}
