export type SignupOnboardingStep = 1 | 2 | 3 | 4;

export type SignupProgress = {
  step: SignupOnboardingStep;
  signupCompleted: boolean;
  planChoiceCompleted: boolean;
};

export type SignupOnboardingInitial = {
  email: string;
  pendingEmail: string;
  firstName: string;
  lastName: string;
  phone: string;
  newsletterOptIn: boolean;
  step: SignupOnboardingStep;
};
