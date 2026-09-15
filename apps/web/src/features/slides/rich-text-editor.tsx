import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading1, Heading2, Italic, List, Redo2, Undo2 } from "lucide-react";

import { ToolbarButton, editorFrameClassName } from "@/features/editor/editor-toolbar";
import { m } from "@/paraglide/messages";

import { docToSource, sourceToDoc } from "./rich-text-doc";

/** Éditeur visuel des diapos texte ; la valeur reste la source légère (`# titre`, `**gras**`). */
export function RichTextEditor({
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  value: string;
  onChange: (source: string) => void;
  labelledBy: string;
  describedBy?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
        orderedList: false,
        strike: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder: m.slide_placeholder() }),
    ],
    content: sourceToDoc(value),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        ...(describedBy !== undefined && { "aria-describedby": describedBy }),
        "data-testid": "slide-editor",
        class: "min-h-60 px-3 py-2 outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(docToSource(current.getJSON())),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      heading1: current?.isActive("heading", { level: 1 }) ?? false,
      heading2: current?.isActive("heading", { level: 2 }) ?? false,
      list: current?.isActive("bulletList") ?? false,
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false,
    }),
  });

  const chain = () => editor?.chain().focus();

  return (
    <div className={editorFrameClassName}>
      <div
        role="toolbar"
        aria-label={m.slide_toolbar()}
        className="flex flex-wrap gap-1 border-b p-1"
      >
        <ToolbarButton
          label={m.slide_bold()}
          icon={Bold}
          active={state?.bold}
          onClick={() => chain()?.toggleBold().run()}
        />
        <ToolbarButton
          label={m.slide_italic()}
          icon={Italic}
          active={state?.italic}
          onClick={() => chain()?.toggleItalic().run()}
        />
        <ToolbarButton
          label={m.slide_heading()}
          icon={Heading1}
          active={state?.heading1}
          onClick={() => chain()?.toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label={m.slide_subheading()}
          icon={Heading2}
          active={state?.heading2}
          onClick={() => chain()?.toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label={m.slide_list()}
          icon={List}
          active={state?.list}
          onClick={() => chain()?.toggleBulletList().run()}
        />
        <span className="bg-border mx-1 w-px self-stretch" aria-hidden />
        <ToolbarButton
          label={m.editor_undo()}
          icon={Undo2}
          disabled={!state?.canUndo}
          onClick={() => chain()?.undo().run()}
        />
        <ToolbarButton
          label={m.editor_redo()}
          icon={Redo2}
          disabled={!state?.canRedo}
          onClick={() => chain()?.redo().run()}
        />
      </div>
      <EditorContent
        editor={editor}
        className="text-sm [&_em]:italic [&_h1]:my-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-1 [&_h2]:text-xl [&_h2]:font-semibold [&_li_p]:my-0 [&_p]:my-1 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
