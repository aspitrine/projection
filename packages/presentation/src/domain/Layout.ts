import { Schema } from "effect";

import { SlideTheme } from "./Theme";

/**
 * Mise en page d'une diapo texte. Elle ne change jamais le contenu : elle décide
 * seulement de la place et de l'accentuation des blocs.
 *
 * - `free` : le thème de la sortie décide de tout (comportement historique).
 * - `title` : titre centré, le reste sert de sous-titre.
 * - `titleBody` : titre en haut, corps aligné à gauche en dessous.
 * - `quote` : citation centrée entre guillemets, attribution en dessous.
 */
export const SlideLayout = Schema.Literals(["free", "title", "titleBody", "quote"]);
export type SlideLayout = typeof SlideLayout.Type;

export const defaultLayout: SlideLayout = "free";

/** Réglages du thème imposés par la mise en page (le reste du thème est conservé). */
export const layoutTheme = (layout: SlideLayout, theme: SlideTheme): SlideTheme => {
  switch (layout) {
    case "free":
      return theme;
    case "title":
    case "quote":
      return new SlideTheme({ ...theme, textAlign: "center", verticalAlign: "center" });
    case "titleBody":
      return new SlideTheme({ ...theme, textAlign: "left", verticalAlign: "top" });
  }
};
