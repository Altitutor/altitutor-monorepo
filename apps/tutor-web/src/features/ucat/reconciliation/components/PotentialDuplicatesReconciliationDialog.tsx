"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from "@altitutor/ui";
import type { Json } from "@altitutor/shared";
import { Loader2, Merge, Pencil, X } from "lucide-react";
import {
  mergePotentialDuplicateStems,
  type PotentialDuplicatePair,
  type PotentialDuplicateStemSide,
} from "../api/reconciliation";
import { UcatRichContentBlock } from "@/features/ucat/question-engine-preview/UcatRichContentBlock";
import { UcatDeleteConfirmDialog } from "@/features/ucat/shared/delete-confirm-dialog";
import { UcatVisibilityBadge } from "@/features/ucat/shared/components/UcatVisibilityBadge";
import { useDeleteUcatQuestionStem } from "@/features/ucat/questions/hooks/useUcatQuestions";
import { proseMirrorToPlainText } from "@/features/ucat/shared/lib/rich-text";
import { ucatKeys } from "@/features/ucat/shared/lib/query-keys";
import { useUcatReconciliationHandlers } from "./UcatReconciliationContext";
import { cn } from "@/shared/utils";
import {
  tutorBtnIconOutline,
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
} from "@/shared/lib/tutor-visual";

type PotentialDuplicatesReconciliationDialogProps = {
  open: boolean;
  pairs: PotentialDuplicatePair[];
  initialPairId?: string | null;
  onOpenChange: (open: boolean) => void;
};

function asRichJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function Explanation({ value }: { value: unknown }) {
  const plainText = proseMirrorToPlainText(value as Json)?.trim() ?? "";
  const json = asRichJson(value);
  if (!plainText && !json) return null;

  return (
    <div className="mt-2 rounded-md bg-muted/40 px-3 py-2">
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Explanation
      </p>
      <UcatRichContentBlock
        json={json}
        plainText={plainText}
        textTone="theme"
        className="text-sm"
      />
    </div>
  );
}

function StemComparePanel({
  sideLabel,
  stem,
  onEdit,
}: {
  sideLabel: string;
  stem: PotentialDuplicateStemSide;
  onEdit: () => void;
}) {
  const stemPlain = proseMirrorToPlainText(stem.stemText as Json) ?? "";
  const questions = [...(stem.questions ?? [])].sort(
    (a, b) => a.index - b.index,
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="shrink-0 space-y-2 border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{sideLabel}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <UcatVisibilityBadge isPrivate={stem.isPrivate} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {stem.sectionName || "Unknown section"}
          {stem.categoryName ? ` · ${stem.categoryName}` : ""}
        </p>
        {stem.setNames.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Sets: {stem.setNames.join(", ")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Not in any set</p>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Stem
          </p>
          <UcatRichContentBlock
            json={asRichJson(stem.stemText)}
            plainText={stemPlain}
            textTone="theme"
            className="text-sm"
          />
        </div>
        {questions.map((question, index) => {
          const questionPlain =
            proseMirrorToPlainText(question.question_text as Json) ?? "";
          return (
            <div key={question.id} className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {index + 1}
              </p>
              <UcatRichContentBlock
                json={asRichJson(question.question_text)}
                plainText={questionPlain}
                textTone="theme"
                className="text-sm"
              />
              {(question.answer_options ?? []).length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {(question.answer_options ?? []).map(
                    (option, optionIndex) => {
                      const optionPlain =
                        proseMirrorToPlainText(option.answer_text as Json) ??
                        "";
                      return (
                        <li
                          key={`${question.id}-opt-${optionIndex}`}
                          className={cn(
                            "rounded-md border px-2 py-1.5",
                            option.is_answer &&
                              "border-green-500/40 bg-green-500/5",
                          )}
                        >
                          <span className="text-muted-foreground">
                            {String.fromCharCode(65 + optionIndex)}.{" "}
                          </span>
                          {optionPlain || "—"}
                          {option.is_answer ? (
                            <span className="ml-2 text-xs font-medium text-green-700 dark:text-green-300">
                              Correct
                            </span>
                          ) : null}
                          <Explanation value={option.answer_explanation} />
                        </li>
                      );
                    },
                  )}
                </ul>
              ) : null}
              <Explanation value={question.answer_explanation} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PotentialDuplicatesReconciliationDialog({
  open,
  pairs,
  initialPairId = null,
  onOpenChange,
}: PotentialDuplicatesReconciliationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { onOpenStemDialog } = useUcatReconciliationHandlers();
  const deleteMutation = useDeleteUcatQuestionStem();
  const [queue, setQueue] = useState<PotentialDuplicatePair[]>([]);
  const [index, setIndex] = useState(0);
  const [pendingDeleteSide, setPendingDeleteSide] = useState<"A" | "B" | null>(
    null,
  );
  const [pendingMergeDirection, setPendingMergeDirection] = useState<
    "A-into-B" | "B-into-A" | null
  >(null);
  const [mergePending, setMergePending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQueue(pairs);
    const startIndex = initialPairId
      ? Math.max(
          0,
          pairs.findIndex((pair) => pair.id === initialPairId),
        )
      : 0;
    setIndex(startIndex === -1 ? 0 : startIndex);
    setPendingDeleteSide(null);
    setPendingMergeDirection(null);
  }, [open, pairs, initialPairId]);

  const current = queue[index] ?? null;
  const remaining = queue.length;

  const similarityLabel = useMemo(() => {
    if (!current) return "";
    const pct = Math.round(
      Math.max(current.tokenRatio, current.trigramRatio) * 100,
    );
    return `${pct}% similar`;
  }, [current]);
  const suggestedMergeDirection = current?.suggestedMergeDirection ?? null;

  function advanceAfterResolve(deletedStemId?: string) {
    const nextQueue = deletedStemId
      ? queue.filter(
          (pair) =>
            pair.stemA.id !== deletedStemId && pair.stemB.id !== deletedStemId,
        )
      : queue.filter((_, pairIndex) => pairIndex !== index);

    if (nextQueue.length === 0) {
      setQueue([]);
      setIndex(0);
      onOpenChange(false);
      return;
    }

    setQueue(nextQueue);
    setIndex((prevIndex) => Math.min(prevIndex, nextQueue.length - 1));
  }

  async function confirmDelete() {
    if (!current || !pendingDeleteSide) return;
    const stem = pendingDeleteSide === "A" ? current.stemA : current.stemB;
    try {
      await deleteMutation.mutateAsync(stem.id);
      await queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliation(),
      });
      toast({
        title: "Question stem deleted",
        description:
          "The selected duplicate was soft-deleted and removed from any sets.",
      });
      setPendingDeleteSide(null);
      advanceAfterResolve(stem.id);
    } catch (err) {
      toast({
        title: "Cannot delete",
        description:
          err instanceof Error
            ? err.message
            : "Failed to delete question stem.",
        variant: "destructive",
      });
    }
  }

  function editStem(stemId: string) {
    onOpenChange(false);
    onOpenStemDialog(stemId);
  }

  async function confirmMerge() {
    if (!current || !pendingMergeDirection) return;
    const target =
      pendingMergeDirection === "B-into-A" ? current.stemA : current.stemB;
    const source =
      pendingMergeDirection === "B-into-A" ? current.stemB : current.stemA;
    setMergePending(true);
    try {
      await mergePotentialDuplicateStems(target.id, source.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() }),
      ]);
      toast({
        title: "Question stems merged",
        description: `Questions were retained on ${pendingMergeDirection === "B-into-A" ? "stem A" : "stem B"}, with source-only stem content moved into the imported questions.`,
      });
      setPendingMergeDirection(null);
      advanceAfterResolve(source.id);
    } catch (err) {
      toast({
        title: "Cannot merge",
        description:
          err instanceof Error
            ? err.message
            : "Failed to merge question stems.",
        variant: "destructive",
      });
    } finally {
      setMergePending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            // Match other reconciliation dialogs: force height (DialogContent base uses sm:h-auto).
            "flex !h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:!h-[92vh] md:max-w-7xl [&>button]:hidden",
            tutorDialogContentClass,
          )}
        >
          <DialogHeader
            className={cn("flex-shrink-0 px-6 py-4", tutorDialogHeaderStrip)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={tutorBtnIconOutline}
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div>
                  <DialogTitle>Compare potential duplicates</DialogTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pair {Math.min(index + 1, Math.max(remaining, 1))} of{" "}
                    {remaining}
                    {current ? ` · ${current.sectionName}` : ""}
                  </p>
                </div>
              </div>
              {current ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{similarityLabel}</Badge>
                  <Badge variant="outline">
                    Token {Math.round(current.tokenRatio * 100)}%
                  </Badge>
                  <Badge variant="outline">
                    Phrase {Math.round(current.trigramRatio * 100)}%
                  </Badge>
                  <Badge
                    variant={
                      current.recommendation === "merge"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {current.recommendation === "merge"
                      ? `Suggested: merge ${current.suggestedMergeDirection === "A-into-B" ? "A into B" : "B into A"}`
                      : "Exact duplicate"}
                  </Badge>
                  {current.sharedTokenPreview.slice(0, 6).map((token) => (
                    <Badge
                      key={token}
                      variant="secondary"
                      className="font-normal"
                    >
                      {token}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 px-6 py-4">
            {!current ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No more potential duplicates in this queue.
              </div>
            ) : (
              <div className="flex h-full min-h-0 gap-4">
                <StemComparePanel
                  sideLabel="Stem A"
                  stem={current.stemA}
                  onEdit={() => editStem(current.stemA.id)}
                />
                <StemComparePanel
                  sideLabel="Stem B"
                  stem={current.stemB}
                  onEdit={() => editStem(current.stemB.id)}
                />
              </div>
            )}
          </div>

          <DialogFooter
            className={cn(
              "flex-shrink-0 flex-row flex-wrap items-center gap-3 px-6 py-4 sm:justify-between",
              tutorDialogFooterStrip,
            )}
          >
            <Button
              type="button"
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => advanceAfterResolve()}
              disabled={!current || deleteMutation.isPending}
            >
              Keep both
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {current?.recommendation === "merge" ? (
                <>
                  <Button
                    type="button"
                    variant={
                      suggestedMergeDirection === "B-into-A"
                        ? "default"
                        : "outline"
                    }
                    className={
                      suggestedMergeDirection === "B-into-A"
                        ? tutorBtnPrimary
                        : tutorBtnOutline
                    }
                    onClick={() => setPendingMergeDirection("B-into-A")}
                    disabled={mergePending}
                  >
                    <Merge className="mr-2 h-4 w-4" />
                    Merge B into A
                    {suggestedMergeDirection === "B-into-A"
                      ? " (Recommended)"
                      : ""}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      suggestedMergeDirection === "A-into-B"
                        ? "default"
                        : "outline"
                    }
                    className={
                      suggestedMergeDirection === "A-into-B"
                        ? tutorBtnPrimary
                        : tutorBtnOutline
                    }
                    onClick={() => setPendingMergeDirection("A-into-B")}
                    disabled={mergePending}
                  >
                    <Merge className="mr-2 h-4 w-4" />
                    Merge A into B
                    {suggestedMergeDirection === "A-into-B"
                      ? " (Recommended)"
                      : ""}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setPendingDeleteSide("A")}
                    disabled={deleteMutation.isPending || mergePending}
                  >
                    {deleteMutation.isPending && pendingDeleteSide === "A" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Delete stem A
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setPendingDeleteSide("B")}
                    disabled={deleteMutation.isPending || mergePending}
                  >
                    {deleteMutation.isPending && pendingDeleteSide === "B" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Delete stem B
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setPendingDeleteSide("A")}
                    disabled={!current || deleteMutation.isPending}
                  >
                    {deleteMutation.isPending && pendingDeleteSide === "A" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Delete stem A
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setPendingDeleteSide("B")}
                    disabled={!current || deleteMutation.isPending}
                  >
                    {deleteMutation.isPending && pendingDeleteSide === "B" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Delete stem B
                  </Button>
                </>
              )}
              <Button
                type="button"
                className={tutorBtnPrimary}
                onClick={() => onOpenChange(false)}
                disabled={deleteMutation.isPending}
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UcatDeleteConfirmDialog
        open={pendingDeleteSide != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDeleteSide(null);
        }}
        title="Delete this question stem?"
        description={
          pendingDeleteSide && current
            ? (() => {
                const stem =
                  pendingDeleteSide === "A" ? current.stemA : current.stemB;
                const setCount = stem.setNames.length;
                return setCount > 0
                  ? `This stem is in ${setCount} set(s). It will be removed from those sets, then soft-deleted with its questions. You can restore it later from the deleted list.`
                  : "This stem and its questions will be soft-deleted. You can restore them later from the deleted list.";
              })()
            : "This stem and its questions will be soft-deleted."
        }
        onConfirm={confirmDelete}
        isPending={deleteMutation.isPending}
      />

      <AlertDialog
        open={pendingMergeDirection != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !mergePending) setPendingMergeDirection(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge these question stems?</AlertDialogTitle>
            <AlertDialogDescription>
              Questions, set memberships, and file links will be retained on{" "}
              {pendingMergeDirection === "B-into-A" ? "stem A" : "stem B"}.
              Content found only on the source stem will be moved into its
              questions so the remaining stem stays reusable. The source stem
              will then be soft-deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mergePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mergePending}
              onClick={(event) => {
                event.preventDefault();
                void confirmMerge();
              }}
            >
              {mergePending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {mergePending ? "Merging..." : "Merge stems"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
