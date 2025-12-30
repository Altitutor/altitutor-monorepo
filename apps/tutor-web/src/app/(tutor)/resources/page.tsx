'use client';

import { TopicsHierarchy } from '@/features/topics/components';
import { useTopicsBySubject } from '@/features/topics/hooks';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { formatSubjectDisplay } from '@/shared/utils';

export default function TutorResourcesPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const { data: subjects = [] } = useSubjects();
  const { data: allTopics = [] } = useTopicsBySubject(selectedSubjectId);
  
  // Filter topics to ensure they match the expected type
  const filteredTopics = allTopics.filter((t: any): t is any => 
    t && typeof t.id === 'string' && typeof t.name === 'string'
  );
  
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
            {subjects.map((subject: any) => (
              <SelectItem key={subject.id} value={subject.id}>
                {formatSubjectDisplay({
                  name: subject.name,
                  curriculum: subject.curriculum,
                  discipline: subject.discipline,
                  level: subject.level,
                  year_level: subject.year_level,
                } as any)}
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
          allTopics={filteredTopics as any}
        />
      </div>
    </div>
  );
}


