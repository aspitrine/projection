/** Résultat d'une action de la barre d'outils sur la zone de texte. */
export interface MarkupEdit {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

/** Entoure la sélection d'un marqueur (`**`, `*`), ou le retire s'il est déjà présent. */
export const toggleWrap = (
  value: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string,
): MarkupEdit => {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const selected = value.slice(start, end);

  if (selected !== "" && before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, -marker.length) + selected + after.slice(marker.length),
      selectionStart: start - marker.length,
      selectionEnd: end - marker.length,
    };
  }

  const content = selected === "" ? placeholder : selected;
  return {
    value: before + marker + content + marker + after,
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length + content.length,
  };
};

const linePrefix = /^(#{1,2}\s+|[-*•]\s+)/;

/** Applique un préfixe de ligne (`# `, `- `) aux lignes sélectionnées, ou le retire. */
export const togglePrefix = (
  value: string,
  start: number,
  end: number,
  prefix: string,
): MarkupEdit => {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split("\n");

  const allPrefixed = lines.every((line) => line.startsWith(prefix));
  const block = lines
    .map((line) =>
      allPrefixed ? line.slice(prefix.length) : prefix + line.replace(linePrefix, ""),
    )
    .join("\n");

  return {
    value: value.slice(0, lineStart) + block + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + block.length,
  };
};
