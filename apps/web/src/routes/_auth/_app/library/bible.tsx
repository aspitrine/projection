import { useAtomValue } from "@effect/atom-react";
import {
  InvalidReference,
  type Passage,
  PassageNotFound,
  verseLabel,
} from "@projection/bible/domain";
import { ContentBlock, scriptureSplitRules, split } from "@projection/presentation/domain";
import { Button } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Cause, Option, Schema } from "effect";
import { useDeferredValue, useState } from "react";

import Loader from "@/components/loader";
import {
  defaultTranslationAtom,
  passageAtom,
  passageKey,
  translationsAtom,
} from "@/features/bible/atoms";
import { TranslationAdmin } from "@/features/bible/translation-admin";
import { SlidePreviewGrid } from "@/features/presentation/slide-preview-grid";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/bible")({
  component: () => (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">{m.nav_bible()}</h1>
      <ClientOnly fallback={<Loader />}>
        <BibleExplorer />
      </ClientOnly>
    </div>
  ),
});

const examples = ["Jean 3.16-18", "Ps 23", "1 Co 13.4-7", "Ésaïe 40.28-31"];

/** Longueur maximale d'une diapo de versets pour l'aperçu (en attendant les thèmes). */
const PREVIEW_MAX_CHARACTERS = 320;

function BibleExplorer() {
  const translations = useAtomValue(translationsAtom);
  const preferred = useAtomValue(defaultTranslationAtom);
  const [translationId, setTranslationId] = useState<string>();
  const [reference, setReference] = useState("");
  const deferredReference = useDeferredValue(reference);

  if (translations._tag === "Initial") return <Loader />;
  if (translations._tag === "Failure") {
    return <p className="text-sm text-red-500">{m.bible_load_error()}</p>;
  }
  if (translations.value.length === 0) {
    return <p className="text-muted-foreground text-sm">{m.bible_no_translation()}</p>;
  }

  const preferredId = preferred._tag === "Success" ? preferred.value : null;
  const selected = translationId ?? preferredId ?? translations.value[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <TranslationAdmin translations={translations.value} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="bible-translation">{m.bible_translation()}</Label>
          <select
            id="bible-translation"
            className="border-input bg-background h-8 rounded-none border px-2 text-xs"
            value={selected}
            onChange={(event) => setTranslationId(event.target.value)}
          >
            {translations.value.map((translation) => (
              <option key={translation.id} value={translation.id}>
                {translation.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-64 flex-1 space-y-1">
          <Label htmlFor="bible-reference">{m.bible_reference()}</Label>
          <Input
            id="bible-reference"
            autoComplete="off"
            placeholder={m.bible_reference_placeholder()}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
        {m.bible_examples()}
        {examples.map((example) => (
          <Button key={example} size="xs" variant="outline" onClick={() => setReference(example)}>
            {example}
          </Button>
        ))}
      </p>

      {deferredReference.trim() === "" ? (
        <p className="text-muted-foreground text-sm">{m.bible_hint()}</p>
      ) : (
        <PassageView lookupKey={passageKey(selected, deferredReference)} />
      )}
    </div>
  );
}

const isInvalidReference = Schema.is(InvalidReference);
const isPassageNotFound = Schema.is(PassageNotFound);

const errorMessage = (error: unknown) => {
  if (isInvalidReference(error)) {
    if (error.reason === "UnknownBook") return m.bible_error_unknown_book({ input: error.input });
    if (error.reason === "InvalidRange") return m.bible_error_invalid_range();
    return m.bible_error_malformed();
  }
  if (isPassageNotFound(error)) {
    return m.bible_error_not_found({ label: error.label });
  }
  return m.bible_load_error();
};

function PassageView({ lookupKey }: { lookupKey: string }) {
  const result = useAtomValue(passageAtom(lookupKey));

  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure") {
    return (
      <p role="alert" className="text-sm text-red-500">
        {errorMessage(Option.getOrUndefined(Cause.findErrorOption(result.cause)))}
      </p>
    );
  }
  return <PassageDetails passage={result.value} />;
}

function PassageDetails({ passage }: { passage: Passage }) {
  const blocks = passage.verses.map(
    (verse) =>
      new ContentBlock({
        key: `${verse.chapter}.${verse.verse}`,
        label: verseLabel(verse),
        lines: [verse.text],
      }),
  );
  const slides = split(blocks, scriptureSplitRules(PREVIEW_MAX_CHARACTERS));

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold" data-testid="passage-label">
            {passage.label}
          </h2>
          <p className="text-muted-foreground text-xs">
            {m.bible_source({
              name: passage.translation.name,
              license: passage.translation.license,
            })}
          </p>
        </div>
        <h3 className="text-muted-foreground text-xs font-medium uppercase">
          {m.bible_verses({ count: passage.verses.length })}
        </h3>
        <div className="space-y-2 text-sm leading-relaxed">
          {passage.verses.map((verse) => (
            <p key={`${verse.chapter}.${verse.verse}`}>
              <sup className="text-muted-foreground mr-1 font-medium">
                {passage.reference.start.chapter === passage.reference.end.chapter
                  ? verse.verse
                  : `${verse.chapter}.${verse.verse}`}
              </sup>
              {verse.text}
            </p>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-medium uppercase">
          {m.bible_slides({ count: slides.length })}
        </h3>
        <SlidePreviewGrid slides={slides} />
      </section>
    </div>
  );
}
