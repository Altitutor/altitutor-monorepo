export type UcatSkillTrainerSetRow = {
  id: string
  skill_trainer_id: string
  trainer_key: string
  trainer_name: string
  name: string
  description: string | null
  is_private: boolean
  item_count: number
  updated_at: string
}

export type UcatSkillTrainerSetItemRow = {
  id: string
  skill_trainer_set_id: string
  skill_trainer_item_id: string
  index: number
  item_content: Record<string, unknown>
  approval_status: 'approved' | 'pending' | 'rejected'
  item_is_active: boolean
}

export type UcatSkillTrainerSetUpsertPayload = {
  setId?: string | null
  skillTrainerId: string
  name: string
  description?: string | null
  isPrivate?: boolean
}
