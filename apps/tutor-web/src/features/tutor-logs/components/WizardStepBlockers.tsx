'use client';

type WizardStepBlockersProps = {
  blockers: string[];
};

export function WizardStepBlockers({ blockers }: WizardStepBlockersProps) {
  if (blockers.length === 0) return null;

  return (
    <div
      className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      role="alert"
    >
      <p className="font-medium">Before you continue:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
    </div>
  );
}
