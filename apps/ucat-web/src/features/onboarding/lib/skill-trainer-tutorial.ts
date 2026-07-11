import type { UcatSkillTrainerKey } from "@altitutor/shared";

export const UCAT_SKILL_TRAINER_TUTORIAL_PREFIX = "ucat-skill-trainer-tutorial";

export function getSkillTrainerTutorialId(
  trainerKey: UcatSkillTrainerKey,
): string {
  return `${UCAT_SKILL_TRAINER_TUTORIAL_PREFIX}:${trainerKey}`;
}
