/**
 * Plus grande taille de police dans [min, max] pour laquelle le contenu tient,
 * par recherche dichotomique. `fits` doit être monotone (vrai en dessous d'un seuil).
 * Renvoie `min` si rien ne tient : le texte déborde alors plutôt que de devenir illisible.
 */
export const fitFontSize = ({
  min,
  max,
  fits,
  precision = 0.1,
}: {
  readonly min: number;
  readonly max: number;
  readonly fits: (size: number) => boolean;
  readonly precision?: number;
}): number => {
  if (fits(max)) return max;
  if (!fits(min)) return min;

  let low = min;
  let high = max;
  while (high - low > precision) {
    const middle = (low + high) / 2;
    if (fits(middle)) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
};
