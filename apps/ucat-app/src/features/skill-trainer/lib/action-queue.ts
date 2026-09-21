import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "../types/attempt";
import { submitLocalSkillTrainerAction } from "./local-session";

type Item = NonNullable<SkillTrainerAttemptState["currentItem"]>;
export type QueuedTrainerAction = {
  actionId: string;
  expectedVersion?: number;
  itemId: string;
  itemIndex: number;
  action: SubmitActionPayload;
};
type Snapshot = {
  state: SkillTrainerAttemptState;
  pending: number;
  error: unknown;
  canSubmit: boolean;
};
type Dependencies = {
  uuid: () => string;
  send: (
    entry: QueuedTrainerAction & { expectedVersion: number },
  ) => Promise<SkillTrainerAttemptState>;
  refresh: () => Promise<SkillTrainerAttemptState>;
  onChange: (snapshot: Snapshot) => void;
  isConflict: (error: unknown) => boolean;
  onFeedback?: (feedback: { correct: boolean; scoreDelta: number }) => void;
};

export function createTrainerActionQueue(
  initial: SkillTrainerAttemptState,
  dependencies: Dependencies,
) {
  let canonical = initial;
  let visible = initial;
  const items = new Map<string, Item>();
  const entries: QueuedTrainerAction[] = [];
  let failure: unknown = null;
  let running: Promise<void> | null = null;
  let stopped = false;
  function remember(state: SkillTrainerAttemptState) {
    for (const item of [state.currentItem, state.nextItem])
      if (item) items.set(item.id, item);
  }
  function emit() {
    dependencies.onChange({
      state: visible,
      pending: entries.length,
      error: failure,
      canSubmit:
        !stopped &&
        !failure &&
        !visible.isCompleted &&
        Boolean(visible.currentItem),
    });
  }
  function rebuild() {
    remember(canonical);
    visible = canonical;
    for (const entry of entries) {
      if (
        visible.isCompleted ||
        !visible.currentItem ||
        visible.currentItem.id !== entry.itemId ||
        visible.attempt.current_item_index !== entry.itemIndex
      )
        break;
      visible = submitLocalSkillTrainerAction(
        visible,
        visible.attempt.config_snapshot.trainer_key,
        entry.action,
        items,
        { completeOnQueueEnd: false },
      );
      // The server reshuffles at the queue boundary; never predict that ordering.
      if (
        visible.attempt.current_item_index >=
        visible.attempt.item_queue_snapshot.length
      )
        visible = { ...visible, currentItem: null, nextItem: null };
    }
    // Feedback/progression is optimistic. Score, clock and completion remain authoritative.
    visible = {
      ...visible,
      isCompleted: canonical.isCompleted && entries.length === 0,
      isExpired: canonical.isExpired,
      attempt: {
        ...visible.attempt,
        score: canonical.attempt.score,
        streak_count: canonical.attempt.streak_count,
        completed_at: canonical.attempt.completed_at,
        ends_at: canonical.attempt.ends_at,
      },
    };
    emit();
  }
  remember(initial);
  function flush(): Promise<void> {
    if (running) return running;
    if (failure) return Promise.reject(failure);
    running = (async () => {
      while (entries.length && !stopped) {
        const entry = entries[0];
        if (
          !canonical.isCompleted &&
          (canonical.currentItem?.id !== entry.itemId ||
            canonical.attempt.current_item_index !== entry.itemIndex)
        ) {
          failure = new Error(
            "This run changed elsewhere. Your unsaved answers have been kept; discard the run to start again.",
          );
          emit();
          throw failure;
        }
        entry.expectedVersion ??= canonical.attempt.version;
        try {
          canonical = await dependencies.send({
            ...entry,
            expectedVersion: entry.expectedVersion,
          });
          entries.shift();
          rebuild();
        } catch (error) {
          failure = error;
          if (dependencies.isConflict(error)) {
            try {
              canonical = await dependencies.refresh();
              // A known conflict was not applied. Rebase only on the same item.
              if (
                canonical.currentItem?.id === entry.itemId &&
                canonical.attempt.current_item_index === entry.itemIndex
              )
                entry.expectedVersion = canonical.attempt.version;
              rebuild();
            } catch {
              /* Keep the original action and its id for an explicit retry. */
            }
          }
          emit();
          throw error;
        }
      }
    })();
    void running
      .finally(() => {
        running = null;
      })
      .catch(() => undefined);
    return running;
  }
  return {
    submit(action: SubmitActionPayload) {
      if (stopped || failure || visible.isCompleted || !visible.currentItem)
        return false;
      const progress = visible.attempt.progress;
      if (
        action.type === "place_word" &&
        progress?.type === "find_word" &&
        progress.placed_keyword_ids.includes(action.keyword_id)
      )
        return false;
      if (
        action.type === "click_occurrence" &&
        progress?.type === "find_concept" &&
        progress.found_occurrence_indexes.includes(action.occurrence_index)
      )
        return false;
      const predicted = submitLocalSkillTrainerAction(
        visible,
        visible.attempt.config_snapshot.trainer_key,
        action,
        items,
        { completeOnQueueEnd: false },
      );
      if (predicted === visible) return false;
      dependencies.onFeedback?.({
        correct: predicted.attempt.streak_count > visible.attempt.streak_count,
        scoreDelta: predicted.attempt.score - visible.attempt.score,
      });
      entries.push({
        actionId: dependencies.uuid(),
        itemId: visible.currentItem.id,
        itemIndex: visible.attempt.current_item_index,
        action,
      });
      rebuild();
      void flush().catch(() => undefined);
      return true;
    },
    drain: flush,
    async retry() {
      failure = null;
      emit();
      await flush();
    },
    async refresh() {
      await flush();
      canonical = await dependencies.refresh();
      rebuild();
    },
    async stop() {
      stopped = true;
      await running?.catch(() => undefined);
    },
    snapshot: () => ({
      state: visible,
      pending: entries.length,
      error: failure,
      canSubmit:
        !stopped &&
        !failure &&
        !visible.isCompleted &&
        Boolean(visible.currentItem),
    }),
  };
}
