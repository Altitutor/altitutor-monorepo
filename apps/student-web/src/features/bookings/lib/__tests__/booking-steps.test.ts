import { subsidyBookingStepIds, trialBookingStepIds } from '../booking-steps';

describe('booking step ids', () => {
  it('adds the subsidy form to trial booking only when they apply and a form is published', () => {
    expect(trialBookingStepIds({ wantsSubsidy: false, hasSubsidyForm: true })).toEqual([
      'instructions',
      'time',
      'contact',
      'subsidy',
      'confirm',
    ]);
    expect(trialBookingStepIds({ wantsSubsidy: true, hasSubsidyForm: false })).toEqual([
      'instructions',
      'time',
      'contact',
      'subsidy',
      'confirm',
    ]);
    expect(trialBookingStepIds({ wantsSubsidy: true, hasSubsidyForm: true })).toEqual([
      'instructions',
      'time',
      'contact',
      'subsidy',
      'application',
      'confirm',
    ]);
  });

  it('skips identity and contact for a signed-in subsidy booking, and skips the form when none is published', () => {
    expect(subsidyBookingStepIds({ signedIn: false, hasSubsidyForm: true })).toEqual([
      'intro',
      'identity',
      'time',
      'contact',
      'application',
      'confirm',
    ]);
    expect(subsidyBookingStepIds({ signedIn: true, hasSubsidyForm: false })).toEqual([
      'time',
      'confirm',
    ]);
    expect(subsidyBookingStepIds({ signedIn: true, hasSubsidyForm: true })).toEqual([
      'time',
      'application',
      'confirm',
    ]);
  });
});
