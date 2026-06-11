import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, Json } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type UcatSkillTrainerRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  sort_order: number;
};

export type UcatSkillTrainerConfigRow = {
  id: string;
  skill_trainer_id: string;
  time_limit_seconds: number;
  wrong_cooldown_seconds: number;
  points_correct: number;
  points_wrong: number;
  streak_enabled: boolean;
  streak_multiplier_steps: Json;
};

export type SkillTrainerConfigUpdate = Partial<
  Pick<
    UcatSkillTrainerConfigRow,
    | 'time_limit_seconds'
    | 'wrong_cooldown_seconds'
    | 'points_correct'
    | 'points_wrong'
    | 'streak_enabled'
    | 'streak_multiplier_steps'
  >
> & { is_enabled?: boolean };

export const ucatSkillTrainerConfigApi = {
  async list(): Promise<
    Array<UcatSkillTrainerRow & { config: UcatSkillTrainerConfigRow | null }>
  > {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data: trainers, error: trainersError } = await supabase
      .from('ucat_skill_trainers')
      .select('*')
      .order('sort_order');
    if (trainersError) throw trainersError;

    const { data: configs, error: configsError } = await supabase
      .from('ucat_skill_trainer_config')
      .select('*');
    if (configsError) throw configsError;

    const configByTrainer = new Map(
      (configs ?? []).map((c) => [c.skill_trainer_id, c as UcatSkillTrainerConfigRow]),
    );

    return (trainers ?? []).map((t) => ({
      ...(t as UcatSkillTrainerRow),
      config: configByTrainer.get(t.id) ?? null,
    }));
  },

  async updateTrainer(
    trainerId: string,
    configId: string,
    updates: SkillTrainerConfigUpdate,
  ): Promise<void> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { is_enabled, ...configUpdates } = updates;

    if (typeof is_enabled === 'boolean') {
      const { error } = await supabase
        .from('ucat_skill_trainers')
        .update({ is_enabled, updated_at: new Date().toISOString() })
        .eq('id', trainerId);
      if (error) throw error;
    }

    if (Object.keys(configUpdates).length > 0) {
      const { error } = await supabase
        .from('ucat_skill_trainer_config')
        .update({ ...configUpdates, updated_at: new Date().toISOString() })
        .eq('id', configId);
      if (error) throw error;
    }
  },
};
