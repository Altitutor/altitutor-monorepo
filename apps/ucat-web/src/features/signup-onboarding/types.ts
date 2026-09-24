export type SignupOnboardingStep = 1 | 2 | 3 | 4 | 5;

export type UcatFamiliarity = "new" | "familiar" | "experienced";

export type SignupProgress = {
  step: SignupOnboardingStep;
  signupCompleted: boolean;
  planChoiceCompleted: boolean;
};

export type SignupOnboardingInitial = {
  userId: string;
  email: string;
  pendingEmail: string;
  firstName: string;
  lastName: string;
  phone: string;
  step: SignupOnboardingStep;
};
