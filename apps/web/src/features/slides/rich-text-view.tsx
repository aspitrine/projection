import type { SlideLayout } from "@projection/presentation/domain";
import { type Block, type Inline, applyLayout } from "@projection/slides/domain";
import { cn } from "@projection/ui/lib/utils";
import { Fragment, type ReactNode } from "react";

function Inlines({ content }: { content: ReadonlyArray<Inline> }) {
  return content.map((part, index) => {
    let node: ReactNode = part.text;
    if (part.italic) node = <em>{node}</em>;
    if (part.bold) node = <strong>{node}</strong>;
    return <Fragment key={index}>{node}</Fragment>;
  });
}

/** Rendu du texte enrichi léger ; les tailles sont relatives à la police du parent. */
export function RichTextView({
  blocks,
  layout = "free",
  className,
}: {
  blocks: ReadonlyArray<Block>;
  layout?: SlideLayout;
  className?: string;
}) {
  const { heading, body, attribution, quoted } = applyLayout(layout, blocks);

  return (
    <div className={cn("space-y-[0.6em]", className)}>
      {heading !== null && (
        <p
          data-slot="slide-heading"
          className={cn(
            "leading-tight font-bold",
            layout === "title" ? "text-[1.8em]" : "text-[1.5em]",
          )}
        >
          <Inlines content={heading} />
        </p>
      )}
      <Blocks blocks={body} quoted={quoted} />
      {attribution !== null && (
        <p data-slot="slide-attribution" className="text-[0.7em] opacity-80">
          — <Inlines content={attribution} />
        </p>
      )}
    </div>
  );
}

/** Blocs du corps ; `quoted` encadre le texte de guillemets français. */
function Blocks({ blocks, quoted = false }: { blocks: ReadonlyArray<Block>; quoted?: boolean }) {
  const last = blocks.length - 1;
  return (
    <div className={cn("space-y-[0.6em]", quoted && "italic")}>
      {blocks.map((block, index) => {
        switch (block._tag) {
          case "Heading":
            return block.level === 1 ? (
              <h2 key={index} className="text-[1.6em] leading-tight font-bold">
                <Inlines content={block.content} />
              </h2>
            ) : (
              <h3 key={index} className="text-[1.25em] leading-tight font-semibold">
                <Inlines content={block.content} />
              </h3>
            );
          case "Paragraph":
            return (
              <p key={index}>
                {quoted && index === 0 && "« "}
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    <Inlines content={line} />
                  </Fragment>
                ))}
                {quoted && index === last && " »"}
              </p>
            );
          case "List":
            return (
              <ul
                key={index}
                className="inline-block list-disc space-y-[0.2em] pl-[1.2em] text-left"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Inlines content={item} />
                  </li>
                ))}
              </ul>
            );
        }
      })}
    </div>
  );
}
