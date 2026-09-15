import { useAtomSet } from "@effect/atom-react";
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit } from "effect";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { createSongAtom, songsReactivity } from "@/features/songs/atoms";
import { mutationErrorMessage } from "@/features/songs/errors";
import { SongEditor, emptySongForm, toSongInput } from "@/features/songs/song-editor";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/songs/new")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <NewSong />
    </ClientOnly>
  ),
});

function NewSong() {
  const navigate = useNavigate();
  const create = useAtomSet(createSongAtom, { mode: "promiseExit" });
  const [submitting, setSubmitting] = useState(false);

  return (
    <SongEditor
      heading={m.song_new_title()}
      initial={emptySongForm}
      submitting={submitting}
      onSubmit={async (values) => {
        setSubmitting(true);
        const exit = await create({
          payload: toSongInput(values),
          reactivityKeys: songsReactivity,
        });
        setSubmitting(false);
        if (Exit.isSuccess(exit)) {
          toast.success(m.song_saved());
          navigate({ to: "/library/songs/$songId", params: { songId: exit.value.id } });
        } else {
          toast.error(mutationErrorMessage(exit));
        }
      }}
    />
  );
}
