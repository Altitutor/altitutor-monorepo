"use client";

import React, { useId, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  RichTextEditor,
  SearchableSelect,
  type JSONContent,
} from "@altitutor/ui";
import { Search } from "lucide-react";
import {
  tutorBtnOutline,
  tutorSurfaceCard,
  tutorToolbarSearchContainerClassName,
} from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

export const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function documentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: string; content?: unknown[] };
  return node.text ?? node.content?.map(documentText).join(" ") ?? "";
}

export function InterviewPanel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(tutorSurfaceCard, "p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function InterviewField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      <div id={labelId} className="text-sm font-medium">
        {label}
      </div>
      {children}
    </div>
  );
}

export function InterviewSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  clear = false,
}: {
  label: string;
  value: string | null;
  options: { id: string; label: string; disabled?: boolean }[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  clear?: boolean;
}) {
  return (
    <SearchableSelect
      items={options}
      value={options.find((option) => option.id === value) ?? null}
      onValueChange={(option) => onChange(option?.id ?? null)}
      getItemId={(option) => option.id}
      getItemLabel={(option) => option.label}
      getItemDisabled={(option) => !!option.disabled}
      placeholder={label}
      ariaLabel={label}
      searchPlaceholder={`Search ${label.toLowerCase()}…`}
      disabled={disabled}
      allowClear={clear}
      fullWidth
    />
  );
}

export function InterviewSearch({
  value,
  onChange,
  placeholder = "Search…",
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          tutorToolbarSearchContainerClassName,
          "flex min-w-48 flex-1 items-center gap-2",
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>
      {children}
    </div>
  );
}

export function InterviewDocument({
  value,
  onChange,
  placeholder,
}: {
  value: JSONContent | null;
  onChange?: (value: JSONContent) => void;
  placeholder?: string;
}) {
  const editor = (
    <RichTextEditor
      content={value ?? emptyDocument}
      onChange={onChange}
      editable={!!onChange}
      placeholder={placeholder}
      minHeight={onChange ? "96px" : "0"}
      autoHeight
      floatingToolbar={!!onChange}
    />
  );
  if (!onChange) return editor;
  return (
    <div className="overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 [&_.ProseMirror]:min-h-[4rem] [&_.ProseMirror]:px-0">
      {editor}
    </div>
  );
}

export function InterviewError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm">
      <p>
        {error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."}
      </p>
      {retry && (
        <Button
          variant="outline"
          className={cn(tutorBtnOutline, "mt-3")}
          onClick={retry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export function ConfirmAction({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
