import { Checkbox, Label } from '@altitutor/ui';

export const WEEKDAY_AVAILABILITY_SLOTS = [
  { key: 'availability_monday', label: 'Monday' },
  { key: 'availability_tuesday', label: 'Tuesday' },
  { key: 'availability_wednesday', label: 'Wednesday' },
  { key: 'availability_thursday', label: 'Thursday' },
  { key: 'availability_friday', label: 'Friday' },
] as const;

export const WEEKEND_AVAILABILITY_SLOTS = [
  { key: 'availability_saturday_am', label: 'Saturday AM' },
  { key: 'availability_saturday_pm', label: 'Saturday PM' },
  { key: 'availability_sunday_am', label: 'Sunday AM' },
  { key: 'availability_sunday_pm', label: 'Sunday PM' },
] as const;

export const STAFF_SESSION_TYPE_AVAILABILITY_SLOTS = [
  { key: 'drafting_availability', label: 'Drafting Sessions' },
  { key: 'trial_session_availability', label: 'Trial Sessions' },
  { key: 'subsidy_interview_availability', label: 'Subsidy Interviews' },
] as const;

export type AvailabilitySlotKey =
  | typeof WEEKDAY_AVAILABILITY_SLOTS[number]['key']
  | typeof WEEKEND_AVAILABILITY_SLOTS[number]['key']
  | typeof STAFF_SESSION_TYPE_AVAILABILITY_SLOTS[number]['key'];

type AvailabilitySlot = { key: AvailabilitySlotKey; label: string };

function AvailabilitySlotRow({
  slot,
  isEditing,
  checked,
  onCheckedChange,
}: {
  slot: AvailabilitySlot;
  isEditing: boolean;
  checked: boolean;
  onCheckedChange?: (key: AvailabilitySlotKey, checked: boolean) => void;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={slot.key}
          checked={checked}
          onCheckedChange={(next) => onCheckedChange?.(slot.key, next === true)}
        />
        <Label htmlFor={slot.key}>{slot.label}</Label>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${checked ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className={`text-sm ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
        {slot.label}
      </span>
    </div>
  );
}

interface AvailabilityFieldsProps {
  isEditing: boolean;
  getValue: (key: AvailabilitySlotKey) => boolean;
  onCheckedChange?: (key: AvailabilitySlotKey, checked: boolean) => void;
  showSessionTypes?: boolean;
}

export function AvailabilityFields({
  isEditing,
  getValue,
  onCheckedChange,
  showSessionTypes = false,
}: AvailabilityFieldsProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">Weekdays</h4>
          <div className={isEditing ? 'space-y-3' : 'space-y-2'}>
            {WEEKDAY_AVAILABILITY_SLOTS.map((slot) => (
              <AvailabilitySlotRow
                key={slot.key}
                slot={slot}
                isEditing={isEditing}
                checked={getValue(slot.key)}
                onCheckedChange={onCheckedChange}
              />
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-3">Weekends</h4>
          <div className={isEditing ? 'space-y-3' : 'space-y-2'}>
            {WEEKEND_AVAILABILITY_SLOTS.map((slot) => (
              <AvailabilitySlotRow
                key={slot.key}
                slot={slot}
                isEditing={isEditing}
                checked={getValue(slot.key)}
                onCheckedChange={onCheckedChange}
              />
            ))}
          </div>
        </div>
      </div>
      {showSessionTypes ? (
        <div className="mt-6">
          <h4 className="font-medium mb-3">Session-Type Availability</h4>
          <div className={isEditing ? 'space-y-3' : 'space-y-2'}>
            {STAFF_SESSION_TYPE_AVAILABILITY_SLOTS.map((slot) => (
              <AvailabilitySlotRow
                key={slot.key}
                slot={slot}
                isEditing={isEditing}
                checked={getValue(slot.key)}
                onCheckedChange={onCheckedChange}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
