import Placeholder from "@tiptap/extension-placeholder";
import { Slice } from "@tiptap/pm/model";
import {
  EditorContent,
  InputRule,
  Node,
  mergeAttributes,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Plus, Redo2, Undo2 } from "lucide-react";

import { ToolbarButton, editorFrameClassName } from "@/features/editor/editor-toolbar";
import { m } from "@/paraglide/messages";

import { type InsertableSection, docToLyrics, lyricsToDoc, nextSectionLabel } from "./lyrics-doc";

/** Étiquette de section (`[Refrain]`) : une ligne à part, mise en évidence. */
const SectionTag = Node.create({
  name: "sectionTag",
  group: "block",
  content: "text*",
  marks: "",
  defining: true,
  parseHTML: () => [{ tag: "div[data-section-tag]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-section-tag": "", class: "section-tag" }),
    0,
  ],
  addInputRules() {
    return [
      // Taper « [Refrain] » en début de ligne crée l'étiquette.
      new InputRule({
        find: /^\[([^\]]+)\]$/,
        handler: ({ state, range, match }) => {
          const label = match[1]?.trim();
          if (!label) return null;
          state.tr
            .delete(range.from, range.to)
            .setBlockType(range.from, range.from, this.type)
            .insertText(label, range.from);
        },
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      // Entrée sur une étiquette : nouvelle ligne de paroles en dessous.
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name !== this.name) return false;
        const after = $from.after();
        return editor
          .chain()
          .insertContentAt(after, { type: "paragraph" })
          .setTextSelection(after + 1)
          .run();
      },
    };
  },
});

const sectionButtons: ReadonlyArray<{ type: InsertableSection; label: () => string }> = [
  { type: "verse", label: m.section_verse },
  { type: "chorus", label: m.section_chorus },
  { type: "pre_chorus", label: m.section_pre_chorus },
  { type: "bridge", label: m.section_bridge },
  { type: "intro", label: m.section_intro },
  { type: "ending", label: m.section_ending },
];

/** Éditeur des paroles : lignes libres et étiquettes de section ; la valeur reste le texte à balises. */
export function LyricsEditor({
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid,
}: {
  value: string;
  onChange: (lyrics: string) => void;
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        underline: false,
      }),
      SectionTag,
      Placeholder.configure({ placeholder: m.song_lyrics_placeholder() }),
    ],
    content: lyricsToDoc(value),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        ...(describedBy !== undefined && { "aria-describedby": describedBy }),
        ...(invalid && { "aria-invalid": "true" }),
        "data-testid": "lyrics-editor",
        class: "min-h-80 px-3 py-2 outline-none",
      },
      // Collage de paroles : une ligne par paragraphe, lignes vides et balises conservées.
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (!text?.includes("\n")) return false;
        const doc = view.state.schema.nodeFromJSON(lyricsToDoc(text));
        view.dispatch(
          view.state.tr.replaceSelection(new Slice(doc.content, 0, 0)).scrollIntoView(),
        );
        return true;
      },
    },
    onUpdate: ({ editor: current }) => onChange(docToLyrics(current.getJSON())),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false,
    }),
  });

  const insertSection = (type: InsertableSection) => {
    if (editor === null) return;
    const label = nextSectionLabel(docToLyrics(editor.getJSON()), type);
    const { $from } = editor.state.selection;
    const block = $from.depth >= 1 ? $from.node(1) : null;
    if (block !== null && block.type.name === "paragraph" && block.content.size === 0) {
      editor.chain().focus().setNode("sectionTag").insertContent(label).run();
      return;
    }
    const start = $from.depth >= 1 ? $from.before(1) : 0;
    editor
      .chain()
      .focus()
      .insertContentAt(start, { type: "sectionTag", content: [{ type: "text", text: label }] })
      .run();
  };

  return (
    <div className={editorFrameClassName}>
      <div
        role="toolbar"
        aria-label={m.song_sections_toolbar()}
        className="flex flex-wrap items-center gap-1 border-b p-1"
      >
        {sectionButtons.map(({ type, label }) => (
          <ToolbarButton key={type} label={label()} icon={Plus} onClick={() => insertSection(type)}>
            {label()}
          </ToolbarButton>
        ))}
        <span className="bg-border mx-1 w-px self-stretch" aria-hidden />
        <ToolbarButton
          label={m.editor_undo()}
          icon={Undo2}
          disabled={!state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <ToolbarButton
          label={m.editor_redo()}
          icon={Redo2}
          disabled={!state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        />
      </div>
      <EditorContent
        editor={editor}
        className="text-sm [&_.section-tag]:mt-3 [&_.section-tag]:mb-1 [&_.section-tag]:w-fit [&_.section-tag]:min-w-16 [&_.section-tag]:bg-sky-500/15 [&_.section-tag]:px-2 [&_.section-tag]:py-0.5 [&_.section-tag]:text-xs [&_.section-tag]:font-semibold [&_.section-tag]:tracking-wide [&_.section-tag]:text-sky-600 [&_.section-tag]:uppercase [&_.section-tag:first-child]:mt-0 dark:[&_.section-tag]:text-sky-300 [&_p]:min-h-5"
      />
    </div>
  );
}
