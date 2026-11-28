"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Tables } from "@altitutor/shared";
import { useTask } from "@/features/tasks/api/queries";
import type { TaskFormData } from "@/features/tasks/types";
import { useWorkItemDetail } from "./useWorkItemDetail";
import { taskFromRecord, taskToRecord } from "./fields";

type Link = { id: string; name: string | null };

/** Task selector metadata follows the record lifetime, independently of form edits. */
export function useTaskDetailEditor({
  id: taskId, enabled = true, form, onClose, issue, project,
}: {
  id: string;
  enabled?: boolean;
  form: UseFormReturn<TaskFormData>;
  onClose: () => void;
  issue?: Link | null;
  project?: Link | null;
}) {
  const detail = useTask(taskId, enabled);
  const lifecycle = useWorkItemDetail({
    kind: "task", id: taskId, enabled, form, onClose, detail,
    title: form.watch("title"), fromRecord: taskFromRecord, toRecord: taskToRecord,
  });
  const { record: task, isLoading } = lifecycle;
  const [selectedAssignee, setSelectedAssignee] =
    useState<Tables<"staff"> | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<{
    id: string;
    name: string | null;
  } | null>(issue ?? null);
  const [selectedProject, setSelectedProject] = useState<{
    id: string;
    name: string | null;
  } | null>(project ?? null);
  const lastResetTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      task &&
      enabled &&
      !isLoading &&
      task.id !== lastResetTaskIdRef.current
    ) {
      if (task.assignee) {
        setSelectedAssignee({
          id: task.assignee.id,
          first_name: task.assignee.first_name,
          last_name: task.assignee.last_name,
        } as Tables<"staff">);
      } else {
        setSelectedAssignee(null);
      }

      setSelectedIssue(
        task.issue
          ? { id: task.issue.id, name: task.issue.name }
          : issue?.id
            ? { id: issue.id, name: issue.name }
            : null,
      );
      setSelectedProject(
        task.project
          ? { id: task.project.id, name: task.project.name }
          : project?.id
            ? { id: project.id, name: project.name }
            : null,
      );
      lastResetTaskIdRef.current = task.id;
    }
  }, [task, enabled, isLoading, form, issue, project]);

  useEffect(() => {
    if (!enabled) {
      lastResetTaskIdRef.current = null;
      setSelectedAssignee(null);
      setSelectedIssue(issue ?? null);
      setSelectedProject(project ?? null);
    }
  }, [enabled, issue, project]);

  const current = enabled && lastResetTaskIdRef.current === taskId;
  return {
    ...lifecycle,
    selectedAssignee: current ? selectedAssignee : null,
    selectedIssue: current ? selectedIssue : issue ?? null,
    selectedProject: current ? selectedProject : project ?? null,
    setSelectedAssignee,
    setSelectedIssue,
    setSelectedProject,
  };
}
