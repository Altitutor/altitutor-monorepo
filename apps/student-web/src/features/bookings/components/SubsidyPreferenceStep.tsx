'use client';

import { RadioGroup, RadioGroupItem } from '@altitutor/ui';
import { Label } from '@altitutor/ui';

export type SubsidyPreference = 'NO' | 'YES';

interface SubsidyPreferenceStepProps {
  value: SubsidyPreference;
  onValueChange: (value: SubsidyPreference) => void;
}

export function SubsidyPreferenceStep({ value, onValueChange }: SubsidyPreferenceStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Our Mission</h3>
        <p className="text-sm text-muted-foreground">
          Altitutor runs as a non-profit, meaning we reinvests every dollar we earn into making transformative education accessible for students who
          need it most.
          <br />
          <br />
          Students who are not able to afford the full price of the session can apply for a subsidy, meaning Altitutor will sponsor part of or all of your tuition fees.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Would you like to apply for a subsidy?</p>
        <RadioGroup
          value={value}
          onValueChange={(nextValue) => onValueChange(nextValue as SubsidyPreference)}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 rounded-md border p-3">
            <RadioGroupItem value="NO" id="subsidy-no" className="mt-0.5" />
            <Label htmlFor="subsidy-no" className="cursor-pointer leading-snug font-normal">
              No - I will be helping out in the nonprofit mission of Altitutor to support other students who are not
              able to afford it.
            </Label>
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <RadioGroupItem value="YES" id="subsidy-yes" className="mt-0.5" />
            <Label htmlFor="subsidy-yes" className="cursor-pointer leading-snug font-normal">
              Yes - I want to apply for a subsidy for myself / my child.
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
