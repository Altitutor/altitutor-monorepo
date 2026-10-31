"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  RichTextEditor,
  Button,
  Input,
  type JSONContent,
  type RichTextEditorRef,
} from "@altitutor/ui";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Link,
} from "lucide-react";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { EmailIconButton } from "./EmailIconButton";
// TipTap whitelists the document schema; these otherwise-supported embedded
// resources must also be blocked before parsing provider HTML or pasted mail.
function editorHtml(html: string) {
  return html.replace(
    /<(?:img|iframe|object|embed|video|audio|source|link)\b[^>]*>/gi,
    "",
  );
}
export function textHtml(text: string) {
  return text
    .split("\n")
    .map(
      (line) =>
        `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") || "<br>"}</p>`,
    )
    .join("");
}
export function signatureHtml(signature: string) {
  return /^\s*</.test(signature) ? signature : textHtml(signature);
}
export function EmailFormatting({
  editor,
  disabled,
}: {
  editor: Editor | null;
  disabled: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("https://");
  const commands = [
    {
      label: "Bold",
      icon: Bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      run: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      label: "Inline code",
      icon: Code,
      run: () => editor?.chain().focus().toggleCode().run(),
    },
    {
      label: "Bullet list",
      icon: List,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Add link",
      icon: Link,
      run: () => {
        setHref("https://");
        setLinkOpen(true);
      },
    },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center">
        {commands.map((command) => (
          <EmailIconButton
            key={command.label}
            label={command.label}
            disabled={disabled || !editor}
            onMouseDown={(event) => event.preventDefault()}
            onClick={command.run}
          >
            <command.icon className="h-4 w-4" />
          </EmailIconButton>
        ))}
      </div>
      <AdminDialogShell
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Add email link"
        footer={
          <Button
            disabled={!/^(?:https?:\/\/|mailto:)\S+$/i.test(href)}
            onClick={() => {
              editor?.chain().focus().setLink({ href }).run();
              setLinkOpen(false);
            }}
          >
            Insert link
          </Button>
        }
      >
        <label className="space-y-2 text-sm">
          URL
          <Input
            aria-label="Email link URL"
            value={href}
            onChange={(event) => setHref(event.target.value)}
          />
        </label>
      </AdminDialogShell>
    </>
  );
}
export const EmailBodyEditor = forwardRef<
  RichTextEditorRef,
  {
    html: string;
    disabled: boolean;
    onChange: (value: { bodyText: string; bodyHtml: string }) => void;
    onEditorReady?: (editor: Editor) => void;
  }
>(function EmailBodyEditor({ html, disabled, onChange, onEditorReady }, ref) {
  const editor = useRef<Editor | null>(null);
  const [document, setDocument] = useState<JSONContent | string>(() =>
    editorHtml(html),
  );
  const emittedHtml = useRef(html);
  useEffect(() => {
    if (html !== emittedHtml.current) {
      emittedHtml.current = html;
      setDocument(editorHtml(html));
    }
  }, [html]);
  return (
    <div
      className="min-h-40 text-sm [&_.tiptap]:min-h-40 [&_.tiptap]:border-0 [&_.tiptap]:p-0 [&_.tiptap]:outline-none"
      aria-label="Email body editor"
      onPasteCapture={(event) => {
        const pastedHtml = event.clipboardData.getData("text/html");
        if (
          pastedHtml &&
          /<(?:img|iframe|object|embed|video|audio|source|link)\b/i.test(
            pastedHtml,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          editor.current
            ?.chain()
            .focus()
            .insertContent(editorHtml(pastedHtml))
            .run();
        }
      }}
    >
      <RichTextEditor
        ref={ref}
        content={document}
        editable={!disabled}
        minHeight="160px"
        autoHeight
        placeholder="Write a message…"
        onEditorReady={(instance) => {
          editor.current = instance;
          instance.view.dom.setAttribute("aria-label", "Email body");
          instance.view.dom.setAttribute("role", "textbox");
          instance.view.dom.setAttribute("aria-multiline", "true");
          onEditorReady?.(instance);
        }}
        onChange={(json) => {
          if (!editor.current) return;
          emittedHtml.current = editor.current.getHTML();
          setDocument(json);
          onChange({
            bodyText: editor.current.getText(),
            bodyHtml: emittedHtml.current,
          });
        }}
      />
    </div>
  );
});

/** Incoming HTML is isolated: no scripts, forms, provider CSS or tracking images. */
export function EmailBody({
  html,
  text,
}: {
  html?: string | null;
  text: string;
}) {
  const [height, setHeight] = useState(150);
  if (!html)
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-7">
        {text}
      </p>
    );
  // Scripts and forms stay disabled; same-origin permits the parent to size the isolated document.
  return (
    <iframe
      title="Email content"
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      className="w-full rounded-lg border-0 bg-white"
      style={{ height }}
      srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><style>body{font:14px/1.7 system-ui;color:#222;margin:12px;overflow-wrap:anywhere}a{color:#2563eb}img{max-width:100%}</style></head><body>${html}</body></html>`}
      onLoad={(event) => {
        const body = event.currentTarget.contentDocument?.body;
        if (body)
          setHeight(Math.min(2000, Math.max(100, body.scrollHeight + 24)));
      }}
    />
  );
}
