"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { lifecycleErrorToast } from "@/features/ucat/shared/lifecycle-errors";
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
  similarityThreshold: number;
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
  onEditSet,
}: {
  sideLabel: string;
  stem: PotentialDuplicateStemSide;
  onEdit: () => void;
  onEditSet: (setId: string) => void;
}) {
  const stemPlain = proseMirrorToPlainText(stem.stemText as Json) ?? "";
  const questions = [...(stem.questions ?? [])].sort(
    (a, b) => a.index - b.index,
  );
  const sets = stem.sets ?? [];

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
        {sets.length > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
            <span>Sets:</span>
            {sets.map((set, index) => {
              const setId = set.id;
              return (
                <span key={setId ?? `${set.name}-${index}`}>
                  {setId ? (
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      title={set.name}
                      onClick={() => onEditSet(setId)}
                    >
                      {set.name}
                    </button>
                  ) : (
                    <span title={set.name}>{set.name}</span>
                  )}
                  {index < sets.length - 1 ? ", " : null}
                </span>
              );
            })}
          </div>
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
                            option.answer_key_value === 'correct' &&
                              "border-green-500/40 bg-green-500/5",
                          )}
                        >
                          <span className="text-muted-foreground">
                            {String.fromCharCode(65 + optionIndex)}.{" "}
                          </span>
                          {optionPlain || "—"}
                          {option.answer_key_value === 'correct' ? (
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
  similarityThreshold,
  initialPairId = null,
  onOpenChange,
}: PotentialDuplicatesReconciliationDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { onOpenStemDialog, onEditSet } = useUcatReconciliationHandlers();
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

  function confirmDelete() {
    if (!current || !pendingDeleteSide) return;
    const stem = pendingDeleteSide === "A" ? current.stemA : current.stemB;
    setPendingDeleteSide(null);
    advanceAfterResolve(stem.id);
    void deleteMutation.mutateAsync(stem.id).then(() => {
      void queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliationQueue("potential-duplicates"),
      });
      toast({
        title: "Question stem deleted",
        description:
          "The selected duplicate was soft-deleted and removed from any sets.",
      });
    }).catch((err: unknown) => {
      void queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliationQueue("potential-duplicates"),
      });
      toast(lifecycleErrorToast(err, "Cannot delete", router.push, (entityType, entityId) => {
        if (entityType === "stem") {
          onOpenChange(false);
          onOpenStemDialog(entityId);
          return true;
        }
        if (entityType === "set") {
          onOpenChange(false);
          onEditSet(entityId);
          return true;
        }
        return false;
      }));
    });
  }

  function editStem(stemId: string) {
    onOpenChange(false);
    onOpenStemDialog(stemId);
  }

  function confirmMerge() {
    if (!current || !pendingMergeDirection) return;
    const direction = pendingMergeDirection;
    const target =
      direction === "B-into-A" ? current.stemA : current.stemB;
    const source =
      direction === "B-into-A" ? current.stemB : current.stemA;
    setMergePending(true);
    setPendingMergeDirection(null);
    advanceAfterResolve(source.id);
    void mergePotentialDuplicateStems(target.id, source.id, similarityThreshold).then(() => {
      void queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliationQueue("potential-duplicates"),
      });
      void queryClient.invalidateQueries({ queryKey: ucatKeys.questions("all") });
      toast({
        title: "Question stems merged",
        description: `Questions were retained on ${direction === "B-into-A" ? "stem A" : "stem B"}.`,
      });
    }).catch((err: unknown) => {
      void queryClient.invalidateQueries({
        queryKey: ucatKeys.reconciliationQueue("potential-duplicates"),
      });
      toast({
        title: "Cannot merge",
        description:
          err instanceof Error
            ? `${err.message} The queue has been refreshed.`
            : "Failed to merge question stems. The queue has been refreshed.",
        variant: "destructive",
      });
    }).finally(() => {
      setMergePending(false);
    });
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
                  <Badge variant="outline">
                    {Math.round(current.similarity * 100)}% stem similarity
                  </Badge>
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
                  onEditSet={onEditSet}
                />
                <StemComparePanel
                  sideLabel="Stem B"
                  stem={current.stemB}
                  onEdit={() => editStem(current.stemB.id)}
                  onEditSet={onEditSet}
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
            <div />
            <div className="flex flex-wrap items-center gap-2">
              {current ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={tutorBtnOutline}
                    onClick={() => setPendingMergeDirection("B-into-A")}
                    disabled={mergePending}
                  >
                    <Merge className="mr-2 h-4 w-4" />
                    Merge B into A
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={tutorBtnOutline}
                    onClick={() => setPendingMergeDirection("A-into-B")}
                    disabled={mergePending}
                  >
                    <Merge className="mr-2 h-4 w-4" />
                    Merge A into B
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
              ) : null}
              <Button
                type="button"
                className={tutorBtnPrimary}
                onClick={() => onOpenChange(false)}
                disabled={deleteMutation.isPending}
                data-dialog-primary-action=""
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
                const setCount = stem.sets?.length ?? 0;
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
              {pendingMergeDirection === "B-into-A" ? "Stem A" : "Stem B"} is
              the retained version. When both stems contain the same normalized
              question text, its options and explanation from the retained stem
              win. Questions found only on the other stem, set memberships, and
              file links are preserved. The source stem is then soft-deleted.
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
