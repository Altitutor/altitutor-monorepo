/** Internal wizard steps (UI shows 4 dots; steps 4 and 5 share dot 4). */
export type SignupOnboardingStep = 1 | 2 | 3 | 4 | 5;

export type SignupProgress = {
  step: SignupOnboardingStep;
  signupCompleted: boolean;
  planChoiceCompleted: boolean;
  testYear: number | null;
};

export type SignupOnboardingInitial = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  step: SignupOnboardingStep;
  testYear: number | null;
  testDate: string | null;
  targetScores: {
    s1: number | null;
    s2: number | null;
    s3: number | null;
  };
};
