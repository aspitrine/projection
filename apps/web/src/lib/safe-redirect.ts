/** N'accepte que des chemins internes (évite les redirections ouvertes). */
export function safeRedirect(path: string | undefined): string | undefined {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return undefined;
  }
  return path;
}
