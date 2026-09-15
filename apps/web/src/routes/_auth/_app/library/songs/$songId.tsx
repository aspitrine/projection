import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { SongId } from "@projection/shared-kernel";
import { type Song, formatLyrics } from "@projection/songs/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { ClientOnly, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit, Option, Schema } from "effect";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { deleteSongAtom, songAtom, songsReactivity, updateSongAtom } from "@/features/songs/atoms";
import { causeHasTag, mutationErrorMessage } from "@/features/songs/errors";
import { SongEditor, type SongFormValues, toSongInput } from "@/features/songs/song-editor";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/songs/$songId")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <EditSongPage />
    </ClientOnly>
  ),
});

const decodeSongId = Schema.decodeUnknownOption(SongId);

function EditSongPage() {
  const { songId } = Route.useParams();
  return Option.match(decodeSongId(songId), {
    onNone: () => <SongMessage message={m.song_not_found()} />,
    onSome: (id) => <LoadedSong id={id} />,
  });
}

function SongMessage({ message }: { message: string }) {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <p>{message}</p>
      <Link to="/library/songs" className={buttonVariants({ variant: "outline" })}>
        {m.song_back()}
      </Link>
    </div>
  );
}

const toFormValues = (song: Song): SongFormValues => ({
  title: song.title,
  authors: song.authors ?? "",
  copyright: song.copyright ?? "",
  ccli: song.ccli ?? "",
  lyrics: formatLyrics(song),
});

function LoadedSong({ id }: { id: SongId }) {
  const result = useAtomValue(songAtom(id));

  switch (result._tag) {
    case "Initial":
      return <Loader />;
    case "Failure":
      return (
        <SongMessage
          message={
            causeHasTag(result.cause, "SongNotFound") ? m.song_not_found() : m.songs_load_error()
          }
        />
      );
    case "Success":
      return <EditSong key={result.value.id} song={result.value} />;
  }
}

function EditSong({ song }: { song: Song }) {
  const navigate = useNavigate();
  const update = useAtomSet(updateSongAtom, { mode: "promiseExit" });
  const remove = useAtomSet(deleteSongAtom, { mode: "promiseExit" });
  const [submitting, setSubmitting] = useState(false);

  const deleteSong = async () => {
    if (!window.confirm(m.song_delete_confirm({ title: song.title }))) return;
    setSubmitting(true);
    const exit = await remove({ payload: { id: song.id }, reactivityKeys: songsReactivity });
    setSubmitting(false);
    if (Exit.isSuccess(exit)) {
      toast.success(m.song_deleted());
      navigate({ to: "/library/songs" });
    } else {
      toast.error(mutationErrorMessage(exit));
    }
  };

  return (
    <SongEditor
      heading={song.title}
      initial={toFormValues(song)}
      submitting={submitting}
      actions={
        <Button variant="destructive" onClick={deleteSong} disabled={submitting}>
          <Trash2 className="size-4" aria-hidden />
          {m.song_delete()}
        </Button>
      }
      onSubmit={async (values) => {
        setSubmitting(true);
        const exit = await update({
          payload: { id: song.id, input: toSongInput(values) },
          reactivityKeys: songsReactivity,
        });
        setSubmitting(false);
        if (Exit.isSuccess(exit)) {
          toast.success(m.song_saved());
        } else {
          toast.error(mutationErrorMessage(exit));
        }
      }}
    />
  );
}
