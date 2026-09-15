import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { TextSlideId } from "@projection/shared-kernel";
import type { TextSlide } from "@projection/slides/domain";
import { Button, buttonVariants } from "@projection/ui/components/button";
import { ClientOnly, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit, Option, Schema } from "effect";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import {
  deleteSlideAtom,
  slideAtom,
  slidesReactivity,
  updateSlideAtom,
} from "@/features/slides/atoms";
import { isNotFound, slideMutationErrorMessage } from "@/features/slides/errors";
import { SlideEditor, toSlideInput } from "@/features/slides/slide-editor";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/slides/$slideId")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <EditSlidePage />
    </ClientOnly>
  ),
});

const decodeSlideId = Schema.decodeUnknownOption(TextSlideId);

function SlideMessage({ message }: { message: string }) {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <p>{message}</p>
      <Link to="/library/slides" className={buttonVariants({ variant: "outline" })}>
        {m.slide_back()}
      </Link>
    </div>
  );
}

function EditSlidePage() {
  const { slideId } = Route.useParams();
  return Option.match(decodeSlideId(slideId), {
    onNone: () => <SlideMessage message={m.slide_not_found()} />,
    onSome: (id) => <LoadedSlide id={id} />,
  });
}

function LoadedSlide({ id }: { id: TextSlideId }) {
  const result = useAtomValue(slideAtom(id));

  switch (result._tag) {
    case "Initial":
      return <Loader />;
    case "Failure":
      return (
        <SlideMessage
          message={isNotFound(result.cause) ? m.slide_not_found() : m.slides_load_error()}
        />
      );
    case "Success":
      return <EditSlide key={result.value.id} slide={result.value} />;
  }
}

function EditSlide({ slide }: { slide: TextSlide }) {
  const navigate = useNavigate();
  const update = useAtomSet(updateSlideAtom, { mode: "promiseExit" });
  const remove = useAtomSet(deleteSlideAtom, { mode: "promiseExit" });
  const [submitting, setSubmitting] = useState(false);

  const deleteSlide = async () => {
    if (!window.confirm(m.slide_delete_confirm({ title: slide.title }))) return;
    setSubmitting(true);
    const exit = await remove({ payload: { id: slide.id }, reactivityKeys: slidesReactivity });
    setSubmitting(false);
    if (Exit.isSuccess(exit)) {
      toast.success(m.slide_deleted());
      navigate({ to: "/library/slides" });
    } else {
      toast.error(slideMutationErrorMessage(exit));
    }
  };

  return (
    <SlideEditor
      heading={slide.title}
      initial={{ title: slide.title, source: slide.source }}
      submitting={submitting}
      actions={
        <Button variant="destructive" onClick={deleteSlide} disabled={submitting}>
          <Trash2 className="size-4" aria-hidden />
          {m.slide_delete()}
        </Button>
      }
      onSubmit={async (values) => {
        setSubmitting(true);
        const exit = await update({
          payload: { id: slide.id, input: toSlideInput(values) },
          reactivityKeys: slidesReactivity,
        });
        setSubmitting(false);
        if (Exit.isSuccess(exit)) {
          toast.success(m.slide_saved());
        } else {
          toast.error(slideMutationErrorMessage(exit));
        }
      }}
    />
  );
}
