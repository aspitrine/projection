import { ContentBlock } from "@projection/presentation/domain";
import type { ParsedLyrics, SectionType, SongSection } from "@projection/songs/domain";

import { m } from "@/paraglide/messages";

const typeLabels: Record<Exclude<SectionType, "other">, () => string> = {
  verse: m.section_verse,
  pre_chorus: m.section_pre_chorus,
  chorus: m.section_chorus,
  bridge: m.section_bridge,
  intro: m.section_intro,
  interlude: m.section_interlude,
  ending: m.section_ending,
  tag: m.section_tag,
};

export const sectionLabel = (section: SongSection) => {
  const base =
    section.type === "other" ? (section.label ?? m.section_other()) : typeLabels[section.type]();
  return section.number === null ? base : `${base} ${section.number}`;
};

/** Sections dans l'ordre de passage, prêtes pour le moteur de découpage. */
export const toContentBlocks = (lyrics: ParsedLyrics) => {
  const byId = new Map(lyrics.sections.map((section) => [section.id, section]));
  return lyrics.arrangement.flatMap((id) => {
    const section = byId.get(id);
    return section === undefined
      ? []
      : [new ContentBlock({ key: section.id, label: sectionLabel(section), lines: section.lines })];
  });
};

/** Découpage utilisé pour l'aperçu tant que les thèmes de sortie n'existent pas (T2.1). */
export const PREVIEW_MAX_LINES = 4;
