import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { acceptedContentTypes, type MediaAsset } from "@projection/media/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { Input } from "@projection/ui/components/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@projection/ui/components/empty";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Cause, Exit, Option } from "effect";
import { FileUp, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import {
  confirmUploadAtom,
  deleteMediaAtom,
  mediaListAtom,
  mediaReactivity,
  renameMediaAtom,
  requestUploadAtom,
} from "@/features/media/atoms";
import { MediaPreview } from "@/features/media/media-preview";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

export const Route = createFileRoute("/_auth/_app/library/media")({
  component: MediaPage,
});

const formatSize = (bytes: number) => {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1
    ? `${megabytes.toLocaleString(getLocale(), { maximumFractionDigits: 1 })} Mo`
    : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
};

function MediaPage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{m.nav_media()}</h1>
        <p className="text-muted-foreground text-sm">{m.media_intro()}</p>
      </div>
      <ClientOnly fallback={<Loader />}>
        <UploadPanel />
        <MediaGrid />
      </ClientOnly>
    </div>
  );
}

function UploadPanel() {
  const inputId = useId();
  const requestUpload = useAtomSet(requestUploadAtom, { mode: "promiseExit" });
  const confirmUpload = useAtomSet(confirmUploadAtom, { mode: "promiseExit" });
  const [pending, setPending] = useState(0);

  /** Deux temps : le serveur signe l'URL, le navigateur envoie le fichier au stockage. */
  const upload = async (file: File) => {
    const reserved = await requestUpload({
      payload: { name: file.name, contentType: file.type, sizeBytes: file.size },
    });
    if (Exit.isFailure(reserved)) {
      const error = Cause.findErrorOption(reserved.cause);
      toast.error(
        Option.isSome(error) && error.value._tag === "MediaTooLarge"
          ? m.media_too_large({ name: file.name })
          : m.media_unsupported({ name: file.name }),
      );
      return;
    }

    const sent = await fetch(reserved.value.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type },
    }).catch(() => null);
    if (sent === null || !sent.ok) {
      toast.error(m.media_upload_failed({ name: file.name }));
      return;
    }

    const confirmed = await confirmUpload({
      payload: { id: reserved.value.asset.id },
      reactivityKeys: mediaReactivity,
    });
    if (Exit.isSuccess(confirmed)) toast.success(m.media_uploaded({ name: file.name }));
    else toast.error(m.media_upload_failed({ name: file.name }));
  };

  return (
    <section className="space-y-2 border p-4" data-testid="media-upload">
      <label
        htmlFor={inputId}
        className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}
      >
        <FileUp className="size-4" aria-hidden />
        {pending > 0 ? m.media_uploading({ count: pending }) : m.media_choose()}
      </label>
      <input
        id={inputId}
        type="file"
        multiple
        accept={acceptedContentTypes.join(",")}
        className="sr-only"
        onChange={async (event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          setPending((current) => current + files.length);
          for (const file of files) {
            await upload(file);
            setPending((current) => current - 1);
          }
        }}
      />
      <p className="text-muted-foreground text-xs">{m.media_hint()}</p>
    </section>
  );
}

function MediaGrid() {
  const result = useAtomValue(mediaListAtom);

  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure")
    return <p className="text-sm text-red-500">{m.media_load_error()}</p>;
  if (result.value.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageIcon />
          </EmptyMedia>
          <EmptyTitle>{m.media_empty_title()}</EmptyTitle>
          <EmptyDescription>{m.media_description()}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="media-grid">
      {result.value.map((asset) => (
        <MediaCard key={asset.id} asset={asset} />
      ))}
    </ul>
  );
}

function MediaCard({ asset }: { asset: MediaAsset }) {
  const remove = useAtomSet(deleteMediaAtom, { mode: "promiseExit" });
  const [editing, setEditing] = useState(false);

  return (
    <li className="space-y-2 border p-2" data-media-kind={asset.kind}>
      <MediaPreview asset={asset} />
      {editing ? (
        <RenameForm asset={asset} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{asset.name}</p>
            <p className="text-muted-foreground text-xs">
              {asset.kind === "image" ? m.media_kind_image() : m.media_kind_video()} ·{" "}
              {formatSize(asset.sizeBytes)}
            </p>
          </div>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`${m.media_rename()} : ${asset.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`${m.media_delete()} : ${asset.name}`}
            onClick={async () => {
              if (!window.confirm(m.media_delete_confirm({ name: asset.name }))) return;
              const exit = await remove({
                payload: { id: asset.id },
                reactivityKeys: mediaReactivity,
              });
              if (Exit.isSuccess(exit)) toast.success(m.media_deleted());
              else toast.error(m.media_action_error());
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}

function RenameForm({ asset, onDone }: { asset: MediaAsset; onDone: () => void }) {
  const rename = useAtomSet(renameMediaAtom, { mode: "promiseExit" });
  const [name, setName] = useState(asset.name);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed === "" || trimmed === asset.name) return onDone();
        setPending(true);
        const exit = await rename({
          payload: { id: asset.id, name: trimmed },
          reactivityKeys: mediaReactivity,
        });
        setPending(false);
        if (Exit.isSuccess(exit)) {
          toast.success(m.media_renamed());
          onDone();
        } else toast.error(m.media_action_error());
      }}
    >
      <Input
        aria-label={m.media_name()}
        className="h-7 min-w-0 flex-1 text-sm"
        required
        maxLength={255}
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDone();
        }}
      />
      <Button type="submit" size="sm" disabled={pending}>
        {m.media_save()}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        {m.media_cancel()}
      </Button>
    </form>
  );
}
