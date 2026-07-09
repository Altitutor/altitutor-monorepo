export type SignupOnboardingStep = 1 | 2 | 3;

export type SignupProgress = {
  step: SignupOnboardingStep;
  signupCompleted: boolean;
  planChoiceCompleted: boolean;
};

export type SignupOnboardingInitial = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  step: SignupOnboardingStep;
};
