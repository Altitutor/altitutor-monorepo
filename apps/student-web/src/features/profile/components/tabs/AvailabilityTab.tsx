'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { Pencil, Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useUpdateProfile } from '../../hooks';
import type { Database } from '@altitutor/shared';

type StudentProfile = Database['public']['Views']['vstudent_profile']['Row'];

interface AvailabilityTabProps {
  profile: StudentProfile;
}

export function AvailabilityTab({ profile }: AvailabilityTabProps) {
  const { toast } = useToast();
  const updateProfile = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    availability_monday: profile.availability_monday || false,
    availability_tuesday: profile.availability_tuesday || false,
    availability_wednesday: profile.availability_wednesday || false,
    availability_thursday: profile.availability_thursday || false,
    availability_friday: profile.availability_friday || false,
    availability_saturday_am: profile.availability_saturday_am || false,
    availability_saturday_pm: profile.availability_saturday_pm || false,
    availability_sunday_am: profile.availability_sunday_am || false,
    availability_sunday_pm: profile.availability_sunday_pm || false,
  });

  const handleInputChange = (field: keyof typeof formData, value: boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      availability_monday: profile.availability_monday || false,
      availability_tuesday: profile.availability_tuesday || false,
      availability_wednesday: profile.availability_wednesday || false,
      availability_thursday: profile.availability_thursday || false,
      availability_friday: profile.availability_friday || false,
      availability_saturday_am: profile.availability_saturday_am || false,
      availability_saturday_pm: profile.availability_saturday_pm || false,
      availability_sunday_am: profile.availability_sunday_am || false,
      availability_sunday_pm: profile.availability_sunday_pm || false,
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    try {
      await updateProfile.mutateAsync(formData);
      
      toast({
        title: 'Success',
        description: 'Availability updated successfully',
      });
      
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update availability',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Availability</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">Weekdays</h4>
              {[
                { key: 'availability_monday', label: 'Monday' },
                { key: 'availability_tuesday', label: 'Tuesday' },
                { key: 'availability_wednesday', label: 'Wednesday' },
                { key: 'availability_thursday', label: 'Thursday' },
                { key: 'availability_friday', label: 'Friday' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={formData[key as keyof typeof formData]}
                    onCheckedChange={(checked) => handleInputChange(key as keyof typeof formData, !!checked)}
                  />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Weekends</h4>
              {[
                { key: 'availability_saturday_am', label: 'Saturday AM' },
                { key: 'availability_saturday_pm', label: 'Saturday PM' },
                { key: 'availability_sunday_am', label: 'Sunday AM' },
                { key: 'availability_sunday_pm', label: 'Sunday PM' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={formData[key as keyof typeof formData]}
                    onCheckedChange={(checked) => handleInputChange(key as keyof typeof formData, !!checked)}
                  />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>
    );
  }

  // View mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Availability</h3>
        <Button variant="outline" size="sm" onClick={handleStartEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">Weekdays</h4>
          <div className="space-y-2">
            {[
              { key: 'availability_monday', label: 'Monday' },
              { key: 'availability_tuesday', label: 'Tuesday' },
              { key: 'availability_wednesday', label: 'Wednesday' },
              { key: 'availability_thursday', label: 'Thursday' },
              { key: 'availability_friday', label: 'Friday' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${profile[key as keyof StudentProfile] ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${profile[key as keyof StudentProfile] ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">Weekends</h4>
          <div className="space-y-2">
            {[
              { key: 'availability_saturday_am', label: 'Saturday AM' },
              { key: 'availability_saturday_pm', label: 'Saturday PM' },
              { key: 'availability_sunday_am', label: 'Sunday AM' },
              { key: 'availability_sunday_pm', label: 'Sunday PM' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${profile[key as keyof StudentProfile] ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${profile[key as keyof StudentProfile] ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

