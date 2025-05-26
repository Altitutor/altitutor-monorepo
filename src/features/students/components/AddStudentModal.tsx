'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Student } from '@/shared/lib/supabase/database/types';
import { StudentStatus } from '@/shared/lib/supabase/database/types';
import { studentsApi } from '../api';
import { useToast } from "@/components/ui/use-toast";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Form schema for adding students
const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  studentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  studentPhone: z.string().optional().nullish(),
  parentFirstName: z.string().optional().nullish(),
  parentLastName: z.string().optional().nullish(),
  parentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  parentPhone: z.string().optional().nullish(),
  school: z.string().optional().nullish(),
  curriculum: z.string().optional().nullish(),
  yearLevel: z.union([
    z.number().min(1).max(12).nullable(),
    z.literal('').transform(() => null)
  ]).optional(),
  status: z.nativeEnum(StudentStatus),
  notes: z.string().optional().nullish(),
  
  // Availability checkboxes
  availability_monday: z.boolean(),
  availability_tuesday: z.boolean(),
  availability_wednesday: z.boolean(),
  availability_thursday: z.boolean(),
  availability_friday: z.boolean(),
  availability_saturday_am: z.boolean(),
  availability_saturday_pm: z.boolean(),
  availability_sunday_am: z.boolean(),
  availability_sunday_pm: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
}

export function AddStudentModal({ isOpen, onClose, onStudentAdded }: AddStudentModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    studentEmail: '',
    studentPhone: '',
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    school: '',
    curriculum: '',
    yearLevel: '',
    status: StudentStatus.TRIAL,
    notes: '',
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
      const studentData: Partial<Student> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        studentEmail: formData.studentEmail || null,
        studentPhone: formData.studentPhone || null,
        parentFirstName: formData.parentFirstName || null,
        parentLastName: formData.parentLastName || null,
        parentEmail: formData.parentEmail || null,
        parentPhone: formData.parentPhone || null,
        school: formData.school || null,
        curriculum: formData.curriculum || null,
        yearLevel: formData.yearLevel ? parseInt(formData.yearLevel) : null,
        status: formData.status,
        notes: formData.notes || null,
        availabilityMonday: formData.availabilityMonday,
        availabilityTuesday: formData.availabilityTuesday,
        availabilityWednesday: formData.availabilityWednesday,
        availabilityThursday: formData.availabilityThursday,
        availabilityFriday: formData.availabilityFriday,
        availabilitySaturdayAm: formData.availabilitySaturdayAm,
        availabilitySaturdayPm: formData.availabilitySaturdayPm,
        availabilitySundayAm: formData.availabilitySundayAm,
        availabilitySundayPm: formData.availabilitySundayPm,
      };

      await studentsApi.createStudent(studentData);
      
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
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
        school: '',
        curriculum: '',
        yearLevel: '',
        status: StudentStatus.TRIAL,
        notes: '',
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
                <Input
                  id="studentPhone"
                  value={formData.studentPhone}
                  onChange={(e) => handleInputChange('studentPhone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Parent Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Parent Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parentFirstName">Parent First Name</Label>
                <Input
                  id="parentFirstName"
                  value={formData.parentFirstName}
                  onChange={(e) => handleInputChange('parentFirstName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="parentLastName">Parent Last Name</Label>
                <Input
                  id="parentLastName"
                  value={formData.parentLastName}
                  onChange={(e) => handleInputChange('parentLastName', e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parentEmail">Parent Email</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="parentPhone">Parent Phone</Label>
                <Input
                  id="parentPhone"
                  value={formData.parentPhone}
                  onChange={(e) => handleInputChange('parentPhone', e.target.value)}
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
                <Input
                  id="curriculum"
                  value={formData.curriculum}
                  onChange={(e) => handleInputChange('curriculum', e.target.value)}
                  placeholder="e.g., SACE, IB, VCE"
                />
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
              onValueChange={(value) => handleInputChange('status', value as StudentStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={StudentStatus.TRIAL}>Trial</SelectItem>
                <SelectItem value={StudentStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={StudentStatus.INACTIVE}>Inactive</SelectItem>
                <SelectItem value={StudentStatus.DISCONTINUED}>Discontinued</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any additional notes about the student..."
              rows={3}
            />
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