"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@altitutor/ui";
import { ChevronDown } from "lucide-react";

function splitText(text: string) {
  const match =
    /\n(?:On [^\n]{1,240}wrote:|[-_]{5,}\s*\n(?:From:|Forwarded)|-----Original Message-----|>\s)/i.exec(
      text,
    );
  return match
    ? {
        main: text.slice(0, match.index),
        history: text.slice(match.index).trim(),
      }
    : { main: text, history: "" };
}
function splitHtml(html: string) {
  // Detached template contents remain inert, including provider images/scripts.
  const template = document.createElement("template");
  template.innerHTML = html;
  const marker = template.content.querySelector(
    '.gmail_quote,.yahoo_quoted,.protonmail_quote,.moz-cite-prefix,#divRplyFwdMsg,blockquote[type="cite"],.ms-outlook-mobile-reference-message',
  );
  if (!marker) return { main: html, history: "" };
  const range = document.createRange();
  range.selectNodeContents(template.content);
  range.setStartBefore(marker);
  const history = document.createElement("div");
  history.append(range.extractContents());
  return { main: template.innerHTML, history: history.innerHTML };
}
function IsolatedBody({ html, title }: { html: string; title: string }) {
  const [height, setHeight] = useState(100);
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);
  return (
    <iframe
      title={title}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      scrolling="no"
      className="w-full overflow-hidden rounded-lg border-0 bg-white"
      style={{ height }}
      srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><style>html{overflow:hidden}body{display:flow-root;box-sizing:border-box;font:14px/1.7 system-ui;color:#222;margin:0;padding:12px;overflow-wrap:anywhere}a{color:#2563eb}img,table{max-width:100%}table{table-layout:fixed}td{overflow-wrap:anywhere}</style></head><body>${html}</body></html>`}
      onLoad={(event) => {
        cleanup.current();
        const frame = event.currentTarget;
        const doc = frame.contentDocument;
        const body = doc?.body;
        if (!body || !doc) return;
        const measure = () =>
          setHeight(Math.max(1, Math.ceil(body.scrollHeight)));
        measure();
        const observer =
          typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(measure);
        observer?.observe(body);
        const keyboard = (key: KeyboardEvent) => {
          const target = key.target;
          if (
            key.defaultPrevented ||
            (target &&
              "closest" in target &&
              typeof target.closest === "function" &&
              target.closest(
                "input,textarea,select,[contenteditable],[role=combobox],[role=menu],[role=dialog]",
              ))
          )
            return;
          if (
            key.metaKey ||
            key.ctrlKey ||
            key.altKey ||
            key.isComposing ||
            !["r", "f", "m", "backspace", "u", "a"].includes(
              key.key.toLowerCase(),
            )
          )
            return;
          const forwarded = new KeyboardEvent("keydown", {
            key: key.key,
            shiftKey: key.shiftKey,
            bubbles: true,
            cancelable: true,
          });
          if (!frame.dispatchEvent(forwarded)) key.preventDefault();
        };
        doc.addEventListener("keydown", keyboard);
        cleanup.current = () => {
          observer?.disconnect();
          doc.removeEventListener("keydown", keyboard);
        };
      }}
    />
  );
}
/** Provider HTML stays isolated; quoted history is a disclosure, never discarded. */
export function EmailBody({
  html,
  text,
}: {
  html?: string | null;
  text: string;
}) {
  const [parts, setParts] = useState(() =>
    html ? { main: "", history: "" } : splitText(text),
  );
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setParts(html ? splitHtml(html) : splitText(text));
    setExpanded(false);
  }, [html, text]);
  return (
    <div className="min-w-0 space-y-2">
      {html ? (
        <IsolatedBody html={parts.main} title="Email content" />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-7">
          {parts.main}
        </p>
      )}
      {parts.history && (
        <div>
          <Button
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <ChevronDown
              className={`h-3 w-3 ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide quoted history" : "Show quoted history"}
          </Button>
          <div>
            {expanded &&
              (html ? (
                <IsolatedBody
                  html={parts.history}
                  title="Quoted email history"
                />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {parts.history}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
