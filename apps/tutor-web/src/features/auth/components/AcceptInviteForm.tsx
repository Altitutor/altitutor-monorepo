'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Input,
  Label,
  PhoneInput,
  SkeletonAuthCard,
  Switch,
  validateOptionalPhoneE164,
} from '@altitutor/ui';
import { CheckCircle2, ChevronLeft, Loader2, Search } from 'lucide-react';
import { invitesApi, type AcceptInviteRequest, type ValidateInviteResponse } from '../api/invites';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { cn } from '@/shared/utils';
import { tutorBtnOutline, tutorBtnPrimary, tutorSurfaceCard } from '@/shared/lib/tutor-visual';

const TOTAL_STEPS = 4;
const availabilityOptions = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday_am', 'Saturday AM'],
  ['saturday_pm', 'Saturday PM'],
  ['sunday_am', 'Sunday AM'],
  ['sunday_pm', 'Sunday PM'],
] as const;

type Availability = AcceptInviteRequest['availability'];

const emptyAvailability: Availability = {
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday_am: false,
  saturday_pm: false,
  sunday_am: false,
  sunday_pm: false,
  drafting: false,
};

const stepCopy = [
  { title: 'Your details', description: 'Check the details we have for you.' },
  { title: 'Set your password', description: 'Choose a secure password for Tutor.' },
  { title: 'Teaching preferences', description: 'Select every subject you teach and when you are available.' },
  { title: 'Employment details', description: 'Finish the Altitutor-specific parts of your employment setup.' },
] as const;

function subjectLabel(subject: NonNullable<ValidateInviteResponse['data']>['subjects'][number]) {
  const name = subject.long_name || subject.short_name || subject.name;
  return [subject.curriculum, subject.year_level ? `Year ${subject.year_level}` : null, name, subject.level]
    .filter(Boolean)
    .join(' · ');
}

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [inviteData, setInviteData] = useState<ValidateInviteResponse['data']>(undefined);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability>(emptyAvailability);
  const [birthday, setBirthday] = useState('');
  const [childSafeAgreementNumber, setChildSafeAgreementNumber] = useState('');
  const [childSafePolicyAgreed, setChildSafePolicyAgreed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void invitesApi.validateInvite(token).then((result) => {
      if (cancelled) return;
      if (!result.valid || !result.data) {
        setError(result.error || 'Invalid or expired invite token');
        setValidating(false);
        return;
      }
      setInviteData(result.data);
      setFirstName(result.data.first_name ?? '');
      setLastName(result.data.last_name ?? '');
      setEmail(result.data.email ?? '');
      setPhone(result.data.phone ?? '');
      setSubjectIds(result.data.subject_ids);
      setValidating(false);
    }).catch(() => {
      if (!cancelled) {
        setError('Failed to validate invite. Please try again.');
        setValidating(false);
      }
    });
    return () => { cancelled = true; };
  }, [token]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inviteData?.subjects ?? [];
    return (inviteData?.subjects ?? []).filter((subject) =>
      subjectLabel(subject).toLowerCase().includes(query),
    );
  }, [inviteData?.subjects, search]);

  function validateStep(): boolean {
    setError(null);
    if (step === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        setError('First name and last name are required.');
        return false;
      }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError('Enter a valid email address.');
        return false;
      }
      const phoneResult = validateOptionalPhoneE164(phone);
      if (phoneResult.error || !phoneResult.phone) {
        setError(phoneResult.error || 'Mobile number is required.');
        return false;
      }
    }
    if (step === 2) {
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        setError('Use at least 8 characters with uppercase, lowercase, and a number.');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return false;
      }
    }
    if (step === 3 && subjectIds.length === 0) {
      setError('Select at least one subject you teach.');
      return false;
    }
    if (step === 4) {
      if (!birthday) {
        setError('Birthday is required.');
        return false;
      }
      if (!childSafeAgreementNumber.trim()) {
        setError('Child-safe agreement number is required.');
        return false;
      }
      if (!childSafePolicyAgreed) {
        setError('You must agree to follow the Altitutor Child Safe Policy.');
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  }

  async function completeOnboarding() {
    if (!validateStep()) return;
    const normalizedPhone = validateOptionalPhoneE164(phone).phone;
    if (!normalizedPhone) return;

    setSubmitting(true);
    setError(null);
    try {
      await invitesApi.acceptInvite({
        token,
        email: email.trim().toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: normalizedPhone,
        subject_ids: subjectIds,
        availability,
        birthday,
        child_safe_agreement_number: childSafeAgreementNumber.trim(),
        child_safe_policy_agreed: true,
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        router.replace('/login?invite=success');
        return;
      }
      setSuccess(true);
      window.setTimeout(() => { window.location.href = '/dashboard'; }, 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not finish onboarding.');
      setSubmitting(false);
    }
  }

  if (validating) return <div className="w-full max-w-2xl"><SkeletonAuthCard /></div>;

  if (!inviteData) {
    return (
      <div className={cn(tutorSurfaceCard, 'w-full max-w-md space-y-5 p-8 text-center')}>
        <h1 className="text-2xl font-bold">Invalid invite</h1>
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        <Button onClick={() => router.push('/login')} className="w-full">Go to login</Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className={cn(tutorSurfaceCard, 'w-full max-w-md space-y-4 p-8 text-center')}>
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
        <h1 className="text-2xl font-bold">You&apos;re all set</h1>
        <p className="text-muted-foreground">Opening your tutor dashboard…</p>
      </div>
    );
  }

  return (
    <div className={cn(tutorSurfaceCard, 'w-[min(92vw,48rem)] space-y-6 p-6 sm:p-8')}>
      <div>
        <div className="mb-4 flex gap-2" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <div key={index} className={cn('h-1.5 flex-1 rounded-full', index < step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Step {step} of {TOTAL_STEPS}</p>
        <h1 className="mt-1 text-3xl font-bold">{stepCopy[step - 1].title}</h1>
        <p className="mt-2 text-muted-foreground">{stepCopy[step - 1].description}</p>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="first-name">First name</Label><Input id="first-name" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="last-name">Last name</Label><Input id="last-name" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="space-y-2"><Label>Mobile</Label><PhoneInput value={phone} onChange={setPhone} placeholder="4xx xxx xxx" /></div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
          <p className="text-sm text-muted-foreground">At least 8 characters with uppercase, lowercase, and a number.</p>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3"><Label>Subjects</Label><span className="text-xs text-muted-foreground">{subjectIds.length} selected</span></div>
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all subjects" className="pl-9" /></div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-muted/35 p-2 ring-1 ring-border">
              {filteredSubjects.map((subject) => {
                const checked = subjectIds.includes(subject.id);
                return (
                  <label key={subject.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm hover:bg-background/80">
                    <Checkbox checked={checked} onCheckedChange={(value) => setSubjectIds((current) => value ? [...current, subject.id] : current.filter((id) => id !== subject.id))} />
                    <span>{subjectLabel(subject)}</span>
                  </label>
                );
              })}
            </div>
          </section>
          <section className="space-y-3">
            <Label>Regular availability</Label>
            <div className="grid grid-cols-2 gap-2">
              {availabilityOptions.map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg bg-muted/35 p-2.5 text-sm">
                  <Checkbox checked={availability[key]} onCheckedChange={(value) => setAvailability((current) => ({ ...current, [key]: Boolean(value) }))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
              <div><p className="font-medium">Drafting availability</p><p className="text-xs text-muted-foreground">Available for drafting sessions</p></div>
              <Switch checked={availability.drafting} onCheckedChange={(drafting) => setAvailability((current) => ({ ...current, drafting }))} />
            </div>
          </section>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="birthday">Birthday</Label><Input id="birthday" type="date" max={new Date().toISOString().slice(0, 10)} value={birthday} onChange={(event) => setBirthday(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="child-safe-number">Child-safe agreement number</Label><Input id="child-safe-number" value={childSafeAgreementNumber} onChange={(event) => setChildSafeAgreementNumber(event.target.value)} /></div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/40 p-4">
            <Checkbox checked={childSafePolicyAgreed} onCheckedChange={(value) => setChildSafePolicyAgreed(Boolean(value))} />
            <span className="text-sm">I have read and agree to follow the Altitutor Child Safe Policy provided with my employment documents.</span>
          </label>
          <div className="rounded-xl bg-primary/8 p-4 ring-1 ring-primary/15">
            <p className="font-medium">Payroll setup happens separately in QuickBooks</p>
            <p className="mt-1 text-sm text-muted-foreground">Altitutor will send a secure QuickBooks Employee Self Setup invitation for your address, TFN, super fund and bank account details. Those details are not stored in Tutor.</p>
          </div>
        </div>
      ) : null}

      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" className={tutorBtnOutline} disabled={step === 1 || submitting} onClick={() => { setError(null); setStep((current) => Math.max(1, current - 1)); }}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        {step < TOTAL_STEPS ? (
          <Button type="button" className={tutorBtnPrimary} onClick={next}>Next</Button>
        ) : (
          <Button type="button" className={tutorBtnPrimary} disabled={submitting} onClick={() => void completeOnboarding()}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Finishing…</> : 'Finish setup'}
          </Button>
        )}
      </div>
    </div>
  );
}
