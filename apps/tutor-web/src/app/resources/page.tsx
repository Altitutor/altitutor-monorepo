'use client';

import { TopicsHierarchy } from '@/features/topics/components';
import { useTopics } from '@/features/topics/hooks';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { formatSubjectDisplay } from '@/shared/utils';

export default function TutorResourcesPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const { data: subjects = [] } = useSubjects();
  const { data: allTopics = [] } = useTopics();
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
      </div>
      
      <div className="mb-4">
        <Select value={selectedSubjectId || ''} onValueChange={setSelectedSubjectId}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {formatSubjectDisplay(subject)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="border rounded-lg p-4 bg-card">
        <TopicsHierarchy
          subjectId={selectedSubjectId}
          showAddTopic={false}
          showAddResource={false}
          allTopics={allTopics}
        />
      </div>
    </div>
  );
}


