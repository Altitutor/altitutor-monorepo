'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { useCreateStudent } from '../hooks/useStudentsQuery';
import type { TablesInsert, Tables } from '@altitutor/shared';
import { PhoneInput } from '@altitutor/ui';
import { SubjectSearchPopover } from '@/features/subjects/components';
import { subjectsApi } from '@/features/subjects/api';
import { studentsApi } from '../api';
import { getSubjectIcon } from '@/shared/utils';
import { X } from 'lucide-react';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
}

export function AddStudentModal({ isOpen, onClose, onStudentAdded }: AddStudentModalProps) {
  const { toast } = useToast();
  const createStudentMutation = useCreateStudent();
  const [loading, setLoading] = useState(false);
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Tables<'subjects'>[]>([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    studentEmail: '',
    studentPhone: '',
    school: '',
    curriculum: '',
    yearLevel: '',
    status: 'TRIAL' as Tables<'students'>['status'],
    // Availability fields
    availabilityMonday: false,
    availabilityTuesday: false,
    availabilityWednesday: false,
    availabilityThursday: false,
    availabilityFriday: false,
    availabilitySaturdayAm: false,
    availabilitySaturdayPm: false,
    availabilitySundayAm: false,
    availabilitySundayPm: false,
  });

  // Load subjects when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSubjects();
    }
  }, [isOpen]);

  const loadSubjects = async () => {
    try {
      const subjects = await subjectsApi.getAllSubjects();
      setAllSubjects(subjects);
    } catch (error) {
      console.error('Failed to load subjects:', error);
      toast({
        title: "Error",
        description: "Failed to load subjects. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddSubject = (subject: Tables<'subjects'>) => {
    setSelectedSubjects(prev => [...prev, subject]);
  };

  const handleRemoveSubject = (subjectId: string) => {
    setSelectedSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName) {
      toast({
        title: "Validation Error",
        description: "First name and last name are required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const studentData: any = {
        id: crypto.randomUUID(),
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: (formData.studentEmail || null) as any,
        phone: (formData.studentPhone || null) as any,
        school: formData.school || null,
        curriculum: (formData.curriculum || null) as any,
        year_level: formData.yearLevel ? parseInt(formData.yearLevel) : null,
        status: formData.status,
        availability_monday: formData.availabilityMonday,
        availability_tuesday: formData.availabilityTuesday,
        availability_wednesday: formData.availabilityWednesday,
        availability_thursday: formData.availabilityThursday,
        availability_friday: formData.availabilityFriday,
        availability_saturday_am: formData.availabilitySaturdayAm,
        availability_saturday_pm: formData.availabilitySaturdayPm,
        availability_sunday_am: formData.availabilitySundayAm,
        availability_sunday_pm: formData.availabilitySundayPm,
        created_at: null,
        created_by: null,
        invite_token: null,
        updated_at: null,
        user_id: null,
      };

      const createdStudent = await createStudentMutation.mutateAsync(studentData);
      
      // Assign selected subjects to the student
      if (selectedSubjects.length > 0 && createdStudent) {
        try {
          await Promise.all(
            selectedSubjects.map(subject => 
              studentsApi.assignSubjectToStudent(createdStudent.id, subject.id)
            )
          );
        } catch (subjectError) {
          console.error('Failed to assign some subjects:', subjectError);
          toast({
            title: "Warning",
            description: "Student created but some subjects could not be assigned.",
            variant: "default",
          });
        }
      }
      
      toast({
        title: "Success",
        description: "Student added successfully.",
      });
      
      onStudentAdded();
      onClose();
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        studentEmail: '',
        studentPhone: '',
        school: '',
        curriculum: '',
        yearLevel: '',
        status: 'TRIAL',
        availabilityMonday: false,
        availabilityTuesday: false,
        availabilityWednesday: false,
        availabilityThursday: false,
        availabilityFriday: false,
        availabilitySaturdayAm: false,
        availabilitySaturdayPm: false,
        availabilitySundayAm: false,
        availabilitySundayPm: false,
      });
      setSelectedSubjects([]);
    } catch (error) {
      console.error('Error adding student:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add student.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Enter the student's information below to add them to the system.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Student Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="studentEmail">Student Email</Label>
                <Input
                  id="studentEmail"
                  type="email"
                  value={formData.studentEmail}
                  onChange={(e) => handleInputChange('studentEmail', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="studentPhone">Student Phone</Label>
                <PhoneInput
                  value={formData.studentPhone}
                  onChange={(value) => handleInputChange('studentPhone', value)}
                />
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Academic Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="school">School</Label>
                <Input
                  id="school"
                  value={formData.school}
                  onChange={(e) => handleInputChange('school', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="curriculum">Curriculum</Label>
                <Select
                  value={formData.curriculum}
                  onValueChange={(value) => handleInputChange('curriculum', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select curriculum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SACE">SACE</SelectItem>
                    <SelectItem value="IB">IB</SelectItem>
                    <SelectItem value="PRESACE">PRESACE</SelectItem>
                    <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                    <SelectItem value="MEDICINE">MEDICINE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="yearLevel">Year Level</Label>
                <Input
                  id="yearLevel"
                  type="number"
                  min="1"
                  max="12"
                  value={formData.yearLevel}
                  onChange={(e) => handleInputChange('yearLevel', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={'TRIAL'}>Trial</SelectItem>
                <SelectItem value={'ACTIVE'}>Active</SelectItem>
                <SelectItem value={'INACTIVE'}>Inactive</SelectItem>
                <SelectItem value={'DISCONTINUED'}>Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subjects */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Subjects</h3>
              <SubjectSearchPopover
                selectedSubjects={selectedSubjects}
                onSelectSubject={handleAddSubject}
              />
            </div>
            
            {selectedSubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects selected</p>
            ) : (
              <div className="space-y-2">
                {selectedSubjects.map((subject) => {
                  const Icon = getSubjectIcon(subject.discipline);
                  const subjectDisplay = [
                    subject.curriculum,
                    subject.year_level ? `Year ${subject.year_level}` : '',
                    subject.name
                  ].filter(Boolean).join(' ');
                  
                  return (
                    <div
                      key={subject.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{subjectDisplay}</div>
                          {subject.level && (
                            <p className="text-xs text-muted-foreground">{subject.level}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSubject(subject.id)}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Availability</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Weekdays</h4>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                  <label key={day} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData[`availability${day}` as keyof typeof formData] as boolean}
                      onChange={(e) => handleInputChange(`availability${day}`, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">{day}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Saturday</h4>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.availabilitySaturdayAm}
                    onChange={(e) => handleInputChange('availabilitySaturdayAm', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Morning</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.availabilitySaturdayPm}
                    onChange={(e) => handleInputChange('availabilitySaturdayPm', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Afternoon</span>
                </label>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Sunday</h4>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.availabilitySundayAm}
                    onChange={(e) => handleInputChange('availabilitySundayAm', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Morning</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.availabilitySundayPm}
                    onChange={(e) => handleInputChange('availabilitySundayPm', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Afternoon</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 