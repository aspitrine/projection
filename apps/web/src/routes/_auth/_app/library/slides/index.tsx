import { useAtomValue } from "@effect/atom-react";
import { buttonVariants } from "@projection/ui/components/button";
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
import { Plus, Presentation, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import Loader from "@/components/loader";
import { slidesListAtom } from "@/features/slides/atoms";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

export const Route = createFileRoute("/_auth/_app/library/slides/")({
  component: SlidesPage,
});

function NewSlideLink() {
  return (
    <Link to="/library/slides/new" className={buttonVariants()}>
      <Plus className="size-4" aria-hidden />
      {m.slides_new()}
    </Link>
  );
}

function SlidesPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{m.nav_slides()}</h1>
        <NewSlideLink />
      </div>
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
        <SlidesTable search={deferredSearch} />
      </ClientOnly>
    </div>
  );
}

function SlidesTable({ search }: { search: string }) {
  const result = useAtomValue(slidesListAtom(search));

  if (result._tag === "Initial") return <Loader />;
  if (result._tag === "Failure") {
    return <p className="text-sm text-red-500">{m.slides_load_error()}</p>;
  }

  if (result.value.length === 0) {
    return search.trim() === "" ? (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Presentation />
          </EmptyMedia>
          <EmptyTitle>{m.slides_empty_title()}</EmptyTitle>
          <EmptyDescription>{m.slides_description()}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <NewSlideLink />
        </EmptyContent>
      </Empty>
    ) : (
      <p className="text-muted-foreground text-sm">
        {m.slides_no_results({ search: search.trim() })}
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
            <th className="hidden p-3 font-medium sm:table-cell">{m.songs_column_updated()}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {result.value.map((slide) => (
            <tr key={slide.id} className="hover:bg-muted/50">
              <td className="p-3">
                <Link
                  to="/library/slides/$slideId"
                  params={{ slideId: slide.id }}
                  className="font-medium hover:underline"
                >
                  {slide.title}
                </Link>
              </td>
              <td className="text-muted-foreground hidden p-3 sm:table-cell">
                {dateFormat.format(slide.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
