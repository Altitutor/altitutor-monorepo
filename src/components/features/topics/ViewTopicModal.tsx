'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { topicsApi, subjectsApi } from '@/lib/supabase/api';
import { Topic, Subtopic, Subject } from '@/lib/supabase/db/types';
import { EditTopicModal } from './EditTopicModal';
import { AddSubtopicModal } from './AddSubtopicModal';
import { EditSubtopicModal } from './EditSubtopicModal';
import { PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatSubjectDisplay } from '@/lib/utils';

export interface ViewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onTopicUpdated?: () => void;
}

// Function to get a color for a subject based on curriculum
const getSubjectColor = (subject?: Subject): string => {
  if (!subject || !subject.curriculum) return 'bg-gray-100 text-gray-800';
  
  switch (subject.curriculum) {
    case 'SACE':
      return 'bg-blue-100 text-blue-800';
    case 'IB':
      return 'bg-green-100 text-green-800';
    case 'PRESACE':
      return 'bg-purple-100 text-purple-800';
    case 'PRIMARY':
      return 'bg-amber-100 text-amber-800';
    case 'MEDICINE':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function ViewTopicModal({ isOpen, onClose, topicId, onTopicUpdated }: ViewTopicModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  
  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddSubtopicModalOpen, setIsAddSubtopicModalOpen] = useState(false);
  const [editSubtopicId, setEditSubtopicId] = useState<string | null>(null);
  const [isEditSubtopicModalOpen, setIsEditSubtopicModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && topicId) {
      loadTopic(topicId);
    }
  }, [isOpen, topicId]);

  const loadTopic = async (id: string) => {
    setLoading(true);
    try {
      // Load topic with subject data included
      const topicsWithSubjects = await topicsApi.getTopicsWithSubjects();
      const topicData = topicsWithSubjects.find(t => t.id === id);
      
      if (!topicData) {
        throw new Error('Topic not found');
      }
      
      console.log('Loaded topic data:', topicData);
      console.log('Topic subjects field:', (topicData as any).subjects);
      console.log('Topic subject field:', topicData.subject);
      setTopic(topicData);
      
      // Set subject from the topic's subject property (already included in getTopicsWithSubjects)
      if (topicData.subject) {
        setSubject(topicData.subject);
        console.log('Subject set from topic:', topicData.subject);
      } else if (topicData.subjectId) {
        // Fallback to loading subject directly if not included
        console.log('Topic has subjectId but no subject property, loading manually:', topicData.subjectId);
        const subjectData = await subjectsApi.getSubject(topicData.subjectId);
        setSubject(subjectData || null);
        console.log('Subject loaded manually:', subjectData);
      }

      // Load subtopics
      const subtopicsData = await topicsApi.getSubtopicsByTopic(id);
      setSubtopics(subtopicsData);
      console.log('Loaded subtopics:', subtopicsData);
    } catch (error) {
      console.error('Error loading topic:', error);
      toast({
        title: 'Error',
        description: 'Failed to load topic data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleAddSubtopic = () => {
    setIsAddSubtopicModalOpen(true);
  };

  const handleEditSubtopic = (subtopicId: string) => {
    setEditSubtopicId(subtopicId);
    setIsEditSubtopicModalOpen(true);
  };

  const handleDeleteSubtopic = async (subtopicId: string) => {
    if (confirm('Are you sure you want to delete this subtopic?')) {
      try {
        await topicsApi.deleteSubtopic(subtopicId);
        
        toast({
          title: 'Success',
          description: 'Subtopic deleted successfully',
        });
        
        // Refresh the subtopics list
        if (topicId) {
          const subtopicsData = await topicsApi.getSubtopicsByTopic(topicId);
          setSubtopics(subtopicsData);
        }
        
        // Notify parent component
        if (onTopicUpdated) {
          onTopicUpdated();
        }
      } catch (error) {
        console.error('Error deleting subtopic:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete subtopic',
          variant: 'destructive',
        });
      }
    }
  };

  const handleChange = () => {
    if (topicId) {
      loadTopic(topicId);
    }
    if (onTopicUpdated) {
      onTopicUpdated();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Topic Details</DialogTitle>
          </DialogHeader>
          
          {loading ? (
            <div className="py-6 text-center">Loading topic data...</div>
          ) : topic ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="font-semibold">Name:</div>
                <div className="col-span-2">{topic.name}</div>
                
                <div className="font-semibold">Number:</div>
                <div className="col-span-2">{topic.number}</div>
                
                <div className="font-semibold">Subject:</div>
                <div className="col-span-2">
                  {subject ? (
                    <Badge 
                      variant="outline" 
                      className={`${getSubjectColor(subject)}`}
                    >
                      {formatSubjectDisplay(subject)}
                    </Badge>
                  ) : 'N/A'}
                </div>
                
                {topic.area && (
                  <>
                    <div className="font-semibold">Area:</div>
                    <div className="col-span-2">{topic.area}</div>
                  </>
                )}
              </div>
              
              <Separator />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Subtopics</h3>
                  <Button size="sm" variant="outline" onClick={handleAddSubtopic}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Subtopic
                  </Button>
                </div>
                
                {subtopics.length > 0 ? (
                  <div className="space-y-3">
                    {subtopics.map((subtopic) => (
                      <div key={subtopic.id} className="p-3 border rounded-md flex items-center justify-between">
                        <div>
                          <span className="font-medium">
                            {subtopic.number}. {subtopic.name}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleEditSubtopic(subtopic.id)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No subtopics found for this topic.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-destructive">
              Topic not found or has been deleted.
            </div>
          )}
          
          <DialogFooter>
            <div className="flex space-x-2 justify-between w-full">
              <Button
                variant="outline"
                onClick={handleEdit}
                disabled={!topic}
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit Topic
              </Button>
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Topic Modal */}
      {topic && (
        <EditTopicModal 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          topicId={topicId}
          onTopicUpdated={handleChange}
        />
      )}
      
      {/* Add Subtopic Modal */}
      <AddSubtopicModal
        isOpen={isAddSubtopicModalOpen}
        onClose={() => setIsAddSubtopicModalOpen(false)}
        topicId={topicId}
        onSubtopicAdded={handleChange}
      />
      
      {/* Edit Subtopic Modal */}
      <EditSubtopicModal
        isOpen={isEditSubtopicModalOpen}
        onClose={() => setIsEditSubtopicModalOpen(false)}
        subtopicId={editSubtopicId}
        onSubtopicUpdated={handleChange}
      />
    </>
  );
} 