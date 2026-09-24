"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import {
  AdminLoadingSkeleton,
  SettingsDataTable,
  SettingsPageHeader,
  type SettingsDataTableColumn,
} from "@/shared/components";
import { ScoreProjectionSettingsDialog } from "@/features/score-projection-settings/components/ScoreProjectionSettingsForm";
import { ScoreProjectionSimulator } from "@/features/score-projection-settings/components/ScoreProjectionSimulator";
import { useScoreProjectionSettings } from "@/features/score-projection-settings/hooks/use-score-projection-settings";
import type { ScoreProjectionSettingsWithSection } from "@/features/score-projection-settings/api/score-projection-settings";

export default function ScoreProjectionSettingsPage() {
  const { data, isLoading, error } = useScoreProjectionSettings();
  const [editingRow, setEditingRow] =
    useState<ScoreProjectionSettingsWithSection | null>(null);

  if (isLoading) {
    return <AdminLoadingSkeleton variant="table" />;
  }

  const rows = data ?? [];
  const columns: SettingsDataTableColumn<ScoreProjectionSettingsWithSection>[] =
    [
      {
        key: "section",
        label: "Section",
        render: (row) => <span className="font-medium">{row.sectionName}</span>,
        sortValue: (row) => row.sectionNumber,
        searchValue: (row) => row.sectionName,
      },
      {
        key: "minimum_evidence",
        label: "Minimum evidence",
        render: (row) => row.min_prediction_evidence_weight,
        sortValue: (row) => row.min_prediction_evidence_weight,
        searchValue: (row) => String(row.min_prediction_evidence_weight),
      },
      {
        key: "source_weights",
        label: "Source weights",
        render: (row) =>
          `Mock ${row.mock_source_weight} / Set ${row.set_source_weight} / Practice ${row.practice_source_weight}`,
        searchValue: (row) =>
          `${row.mock_source_weight} ${row.set_source_weight} ${row.practice_source_weight}`,
      },
      {
        key: "default_pace",
        label: "Default pace",
        render: (row) => `${row.default_effective_questions_per_week}/week`,
        sortValue: (row) => row.default_effective_questions_per_week,
        searchValue: (row) => String(row.default_effective_questions_per_week),
      },
      {
        key: "trajectory",
        label: "Trajectory",
        render: (row) => `${row.trajectory_horizon_days} days`,
        sortValue: (row) => row.trajectory_horizon_days,
        searchValue: (row) => String(row.trajectory_horizon_days),
      },
    ];

  return (
    <div className="p-6">
      <SettingsPageHeader title="Score projection settings" />

      {error ? (
        <p className="mb-4 text-sm text-destructive">{error.message}</p>
      ) : null}

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <SettingsDataTable
            data={rows}
            columns={columns}
            getRowId={(row) => row.id}
            emptyMessage="No score projection settings rows found"
            searchPlaceholder="Search score projection settings..."
            filterKeys={[]}
            defaultSort={{ field: "section", direction: "asc" }}
            getActions={(row) => [
              {
                id: "edit",
                label: "Edit",
                onSelect: () => setEditingRow(row),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="simulator">
          <ScoreProjectionSimulator settings={rows} />
        </TabsContent>
      </Tabs>

      <ScoreProjectionSettingsDialog
        open={!!editingRow}
        initial={editingRow}
        onClose={() => setEditingRow(null)}
      />
    </div>
  );
}
