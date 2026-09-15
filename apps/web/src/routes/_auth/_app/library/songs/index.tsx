import { useAtomValue } from "@effect/atom-react";
import { Button, buttonVariants } from "@projection/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@projection/ui/components/empty";
import { Input } from "@projection/ui/components/input";
import { ClientOnly, Link, createFileRoute } from "@tanstack/react-router";
import { FileUp, Music, Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import Loader from "@/components/loader";
import { songsListAtom } from "@/features/songs/atoms";
import { SongImportPanel } from "@/features/songs/import-panel";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

export const Route = createFileRoute("/_auth/_app/library/songs/")({
  component: SongsPage,
});

function NewSongLink() {
  return (
    <Link to="/library/songs/new" className={buttonVariants()}>
      <Plus className="size-4" aria-hidden />
      {m.songs_new()}
    </Link>
  );
}

function SongsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [importing, setImporting] = useState(false);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{m.nav_songs()}</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            aria-expanded={importing}
            onClick={() => setImporting((current) => !current)}
          >
            <FileUp className="size-4" aria-hidden />
            {m.songs_import()}
          </Button>
          <NewSongLink />
        </div>
      </div>
      {importing && (
        <ClientOnly fallback={<Loader />}>
          <SongImportPanel />
        </ClientOnly>
      )}
      <div className="relative max-w-sm">
        <Search
          className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          className="pl-8"
          aria-label={m.songs_search_label()}
          placeholder={m.songs_search_placeholder()}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <ClientOnly fallback={<Loader />}>
        <SongsTable search={deferredSearch} />
      </ClientOnly>
    </div>
  );
}

function SongsTable({ search }: { search: string }) {
  const result = useAtomValue(songsListAtom(search));

  if (result._tag === "Initial") {
    return <Loader />;
  }
  if (result._tag === "Failure") {
    return <p className="text-sm text-red-500">{m.songs_load_error()}</p>;
  }

  const songs = result.value;
  if (songs.length === 0) {
    return search.trim() === "" ? (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Music />
          </EmptyMedia>
          <EmptyTitle>{m.songs_empty_title()}</EmptyTitle>
          <EmptyDescription>{m.songs_description()}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <NewSongLink />
        </EmptyContent>
      </Empty>
    ) : (
      <p className="text-muted-foreground text-sm">
        {m.songs_no_results({ search: search.trim() })}
      </p>
    );
  }

  const dateFormat = new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="overflow-x-auto border">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-left text-xs">
          <tr>
            <th className="p-3 font-medium">{m.songs_column_title()}</th>
            <th className="hidden p-3 font-medium sm:table-cell">{m.songs_column_authors()}</th>
            <th className="hidden p-3 font-medium md:table-cell">{m.songs_column_updated()}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {songs.map((song) => (
            <tr key={song.id} className="hover:bg-muted/50">
              <td className="p-3">
                <Link
                  to="/library/songs/$songId"
                  params={{ songId: song.id }}
                  className="font-medium hover:underline"
                >
                  {song.title}
                </Link>
              </td>
              <td className="text-muted-foreground hidden p-3 sm:table-cell">{song.authors}</td>
              <td className="text-muted-foreground hidden p-3 md:table-cell">
                {dateFormat.format(song.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
