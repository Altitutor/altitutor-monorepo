'use client';

import { useState } from 'react';
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@altitutor/ui';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { IssuesBoard } from '@/features/issues/components/IssuesBoard';
import { IssuesList } from '@/features/issues/components/IssuesList';
import { IssueDialog } from '@/features/issues/components/IssueDialog';
import { useCreateIssue } from '@/features/issues/api/mutations';

export default function IssuesPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newIssueId, setNewIssueId] = useState<string | null>(null);
  
  const createIssue = useCreateIssue();

  const handleCreateIssue = async () => {
    try {
      const result = await createIssue.mutateAsync({
        issue: {
          name: 'New Issue',
          status: 'open',
        },
      });
      setNewIssueId(result.id);
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--navbar-height)-64px)] overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 px-6 py-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={view} onValueChange={(v) => setView(v as 'kanban' | 'list')}>
            <TabsList>
              <TabsTrigger value="kanban" className="px-2">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-2">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleCreateIssue} disabled={createIssue.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            {createIssue.isPending ? 'Creating...' : 'New Issue'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? (
          <IssuesBoard />
        ) : (
          <IssuesList />
        )}
      </div>

      {newIssueId && (
        <IssueDialog
          isOpen={!!newIssueId}
          onClose={() => setNewIssueId(null)}
          issueId={newIssueId}
        />
      )}
    </div>
  );
}
