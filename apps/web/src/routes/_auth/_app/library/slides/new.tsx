import { useAtomSet } from "@effect/atom-react";
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Exit } from "effect";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { createSlideAtom, slidesReactivity } from "@/features/slides/atoms";
import { slideMutationErrorMessage } from "@/features/slides/errors";
import { SlideEditor, emptySlideForm, toSlideInput } from "@/features/slides/slide-editor";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth/_app/library/slides/new")({
  component: () => (
    <ClientOnly fallback={<Loader />}>
      <NewSlide />
    </ClientOnly>
  ),
});

function NewSlide() {
  const navigate = useNavigate();
  const create = useAtomSet(createSlideAtom, { mode: "promiseExit" });
  const [submitting, setSubmitting] = useState(false);

  return (
    <SlideEditor
      heading={m.slide_new_title()}
      initial={emptySlideForm}
      submitting={submitting}
      onSubmit={async (values) => {
        setSubmitting(true);
        const exit = await create({
          payload: toSlideInput(values),
          reactivityKeys: slidesReactivity,
        });
        setSubmitting(false);
        if (Exit.isSuccess(exit)) {
          toast.success(m.slide_saved());
          navigate({ to: "/library/slides/$slideId", params: { slideId: exit.value.id } });
        } else {
          toast.error(slideMutationErrorMessage(exit));
        }
      }}
    />
  );
}
