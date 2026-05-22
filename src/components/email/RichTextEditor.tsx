"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  onCmdEnter?: () => void;
  placeholder?: string;
  minHeight?: number;
}

const C = {
  navy: "#0B1C3D",
  coral: "#FF6B4A",
  gray: "#9CA3AF",
  border: "#E5E7EB",
};

export function RichTextEditor({
  value,
  onChange,
  onCmdEnter,
  placeholder = "Write your message…",
  minHeight = 220,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Image.configure({ inline: true, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "compose-tiptap",
        style: `min-height:${minHeight}px;outline:none;padding:10px 12px;font-size:14px;line-height:1.55;color:${C.navy};`,
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onCmdEnter?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  // Sync external value (e.g., reply prefill) when editor exists.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Toolbar editor={editor} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .compose-tiptap p { margin: 0 0 8px; }
        .compose-tiptap p:last-child { margin-bottom: 0; }
        .compose-tiptap ul, .compose-tiptap ol { padding-left: 22px; margin: 0 0 8px; }
        .compose-tiptap a { color: ${C.coral}; text-decoration: underline; }
        .compose-tiptap blockquote { border-left: 3px solid ${C.border}; padding-left: 10px; color: #6B7280; margin: 0 0 8px; }
        .compose-tiptap code { background: #F3F4F6; padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
        .compose-tiptap pre { background: #0F172A; color: #E2E8F0; padding: 10px; border-radius: 6px; overflow-x: auto; }
        .compose-tiptap img { max-width: 100%; height: auto; border-radius: 4px; }
        .compose-tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: ${C.gray};
          float: left;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean, onClick: () => void, label: string, title: string) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      style={{
        border: "none",
        background: active ? "#EEF2F7" : "transparent",
        color: active ? C.navy : "#4B5563",
        padding: "5px 9px",
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertImage = () => {
    const url = window.prompt("Image URL (paste a hosted image link)");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        padding: "5px 6px",
        borderBottom: `1px solid ${C.border}`,
        background: "#FAFAFA",
        flexWrap: "wrap",
      }}
    >
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "B", "Bold (⌘B)")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "I", "Italic (⌘I)")}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "U", "Underline (⌘U)")}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "S", "Strikethrough")}
      <Divider />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "•", "Bullet list")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1.", "Numbered list")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "❝", "Quote")}
      <Divider />
      {btn(editor.isActive("link"), setLink, "🔗", "Add link")}
      {btn(false, insertImage, "🖼", "Insert image by URL")}
      {btn(editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), "</>", "Inline code")}
    </div>
  );
}

function Divider() {
  return <span style={{ width: 1, background: "#E5E7EB", margin: "4px 4px" }} />;
}
