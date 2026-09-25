export type TrialBookingStepId =
  | 'instructions'
  | 'time'
  | 'contact'
  | 'subsidy'
  | 'application'
  | 'confirm';

export function trialBookingStepIds(input: {
  wantsSubsidy: boolean;
  hasSubsidyForm: boolean;
}): TrialBookingStepId[] {
  return [
    'instructions',
    'time',
    'contact',
    'subsidy',
    ...(input.wantsSubsidy && input.hasSubsidyForm ? (['application'] as const) : []),
    'confirm',
  ];
}

export type SubsidyBookingStepId = 'intro' | 'identity' | 'time' | 'contact' | 'application' | 'confirm';

export function subsidyBookingStepIds(input: {
  signedIn: boolean;
  hasSubsidyForm: boolean;
}): SubsidyBookingStepId[] {
  if (input.signedIn) {
    return [
      'time',
      ...(input.hasSubsidyForm ? (['application'] as const) : []),
      'confirm',
    ];
  }
  return [
    'intro',
    'identity',
    'time',
    'contact',
    ...(input.hasSubsidyForm ? (['application'] as const) : []),
    'confirm',
  ];
}
