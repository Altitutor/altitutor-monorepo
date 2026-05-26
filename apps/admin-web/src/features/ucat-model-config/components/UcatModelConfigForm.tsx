'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@altitutor/ui';
import type { UcatModelConfigWithSection } from '@/features/ucat-model-config/api/ucat-model-config';
import { useUpdateUcatModelConfig } from '@/features/ucat-model-config/hooks/use-ucat-model-config';

type UcatModelConfigFormProps = {
  initial: UcatModelConfigWithSection;
};

export function UcatModelConfigForm({ initial }: UcatModelConfigFormProps) {
  const updateMutation = useUpdateUcatModelConfig();
  const [kPrior, setKPrior] = useState(String(initial.k_prior));
  const [sInfUplift, setSInfUplift] = useState(String(initial.s_inf_uplift));
  const [rNoise, setRNoise] = useState(String(initial.r_noise));
  const [p0, setP0] = useState(String(initial.p0));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setKPrior(String(initial.k_prior));
    setSInfUplift(String(initial.s_inf_uplift));
    setRNoise(String(initial.r_noise));
    setP0(String(initial.p0));
    setError(null);
  }, [initial]);

  const handleSave = async () => {
    setError(null);
    const parsedK = Number(kPrior);
    const parsedSInfUplift = Number(sInfUplift);
    const parsedRNoise = Number(rNoise);
    const parsedP0 = Number(p0);

    if (!Number.isFinite(parsedK) || parsedK <= 0) {
      setError('Learning rate prior (k) must be greater than 0.');
      return;
    }
    if (!Number.isFinite(parsedSInfUplift) || parsedSInfUplift <= 0) {
      setError('Ceiling uplift must be greater than 0.');
      return;
    }
    if (!Number.isFinite(parsedRNoise) || parsedRNoise <= 0) {
      setError('Measurement noise (R) must be greater than 0.');
      return;
    }
    if (!Number.isFinite(parsedP0) || parsedP0 <= 0) {
      setError('Initial uncertainty (P0) must be greater than 0.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: initial.id,
        updates: {
          k_prior: parsedK,
          s_inf_uplift: parsedSInfUplift,
          r_noise: parsedRNoise,
          p0: parsedP0,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial.sectionName}</CardTitle>
        <CardDescription>
          Section {initial.sectionNumber} cold-start constants used before enough personal observations exist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${initial.id}-k-prior`}>Learning rate prior (k)</Label>
            <Input
              id={`${initial.id}-k-prior`}
              type="number"
              step="0.000001"
              min={0}
              value={kPrior}
              onChange={(e) => setKPrior(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${initial.id}-s-inf-uplift`}>Ceiling uplift</Label>
            <Input
              id={`${initial.id}-s-inf-uplift`}
              type="number"
              step="1"
              min={0}
              value={sInfUplift}
              onChange={(e) => setSInfUplift(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${initial.id}-r-noise`}>Measurement noise (R)</Label>
            <Input
              id={`${initial.id}-r-noise`}
              type="number"
              step="1"
              min={1}
              value={rNoise}
              onChange={(e) => setRNoise(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${initial.id}-p0`}>Initial uncertainty (P0)</Label>
            <Input
              id={`${initial.id}-p0`}
              type="number"
              step="1"
              min={1}
              value={p0}
              onChange={(e) => setP0(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save constants'}
        </Button>
      </CardContent>
    </Card>
  );
}
