import { useAtomValue } from "@effect/atom-react";
import { Input } from "@projection/ui/components/input";
import { Label } from "@projection/ui/components/label";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, Music, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import Loader from "@/components/loader";
import { scriptureSearchAtom, searchKey, translationsAtom } from "@/features/bible/atoms";
import { songsListAtom } from "@/features/songs/atoms";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/search")({
  component: () => (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{m.nav_search()}</h1>
        <p className="text-muted-foreground text-sm">{m.search_intro()}</p>
      </div>
      <ClientOnly fallback={<Loader />}>
        <UnifiedSearch />
      </ClientOnly>
    </div>
  ),
});

/** Les extraits arrivent du serveur avec les mots trouvés encadrés par « ». */
function Excerpt({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      {text.split(/(«[^»]*»)/).map((part, index) =>
        part.startsWith("«") && part.endsWith("»") ? (
          <mark key={index} className="bg-amber-400/30 text-foreground">
            {part.slice(1, -1)}
          </mark>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const translations = useAtomValue(translationsAtom);
  const [translationId, setTranslationId] = useState<string>();

  const available = translations._tag === "Success" ? translations.value : [];
  const selected = translationId ?? available[0]?.id ?? "";
  const enabled = deferred.length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 space-y-1">
          <Label htmlFor="search-query">{m.search_query()}</Label>
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="search-query"
              type="search"
              className="pl-8"
              placeholder={m.search_placeholder()}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        {available.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="search-translation">{m.bible_translation()}</Label>
            <select
              id="search-translation"
              className="border-input bg-background h-8 border px-2 text-sm"
              value={selected}
              onChange={(event) => setTranslationId(event.target.value)}
            >
              {available.map((translation) => (
                <option key={translation.id} value={translation.id}>
                  {translation.code}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!enabled ? (
        <p className="text-muted-foreground text-sm">{m.search_hint()}</p>
      ) : (
        <>
          <SongResults query={deferred} />
          {selected !== "" && <ScriptureResults translationId={selected} query={deferred} />}
        </>
      )}
    </div>
  );
}

function SongResults({ query }: { query: string }) {
  const result = useAtomValue(songsListAtom(query));

  return (
    <section className="space-y-2" aria-labelledby="search-songs" data-testid="search-songs">
      <h2 id="search-songs" className="flex items-center gap-2 font-medium">
        <Music className="size-4" aria-hidden />
        {m.search_songs({ count: result._tag === "Success" ? result.value.length : 0 })}
      </h2>
      {result._tag === "Initial" ? (
        <Loader />
      ) : result._tag === "Failure" ? (
        <p className="text-sm text-red-500">{m.songs_load_error()}</p>
      ) : result.value.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.search_no_song()}</p>
      ) : (
        <ul className="divide-y border">
          {result.value.map((song) => (
            <li key={song.id} className="space-y-1 p-3">
              <Link
                to="/library/songs/$songId"
                params={{ songId: song.id }}
                className="font-medium hover:underline"
              >
                {song.title}
              </Link>
              {song.excerpt !== null && <Excerpt text={song.excerpt} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScriptureResults({ translationId, query }: { translationId: string; query: string }) {
  const result = useAtomValue(scriptureSearchAtom(searchKey(translationId, query)));

  return (
    <section className="space-y-2" aria-labelledby="search-verses" data-testid="search-verses">
      <h2 id="search-verses" className="flex items-center gap-2 font-medium">
        <BookOpen className="size-4" aria-hidden />
        {m.search_verses({ count: result._tag === "Success" ? result.value.length : 0 })}
      </h2>
      {result._tag === "Initial" ? (
        <Loader />
      ) : result._tag === "Failure" ? (
        <p className="text-sm text-red-500">{m.bible_load_error()}</p>
      ) : result.value.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.search_no_verse()}</p>
      ) : (
        <ul className="divide-y border">
          {result.value.map((match) => (
            <li
              key={`${match.verse.book}-${match.verse.chapter}-${match.verse.verse}`}
              className="space-y-1 p-3"
            >
              <p className="text-sm font-medium">{match.label}</p>
              <Excerpt text={match.excerpt} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
