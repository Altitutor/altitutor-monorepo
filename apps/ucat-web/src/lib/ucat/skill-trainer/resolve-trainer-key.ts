import {
  isUcatSkillTrainerKey,
  trainerSlugToKey,
  type UcatSkillTrainerKey,
} from "@altitutor/shared";

/** Accepts snake_case key or kebab-case slug from URL params. */
export function resolveTrainerKeyParam(param: string): UcatSkillTrainerKey | null {
  if (isUcatSkillTrainerKey(param)) return param;
  return trainerSlugToKey(param);
}
