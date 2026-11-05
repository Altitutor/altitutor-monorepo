export interface StoredAdminShiftSchedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom: string;
  effectiveTo: string;
}

export interface AdminShiftScheduleProposal {
  admin_shift_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: 'ACTIVE' | 'INACTIVE';
  start_date: string;
  end_date: string;
  effective_from: string;
  timezone: 'Australia/Adelaide';
}

export interface AdminShiftSchedulePlan {
  proposal_hash: string;
  counts: {
    create: number;
    cancel: number;
    preserve: number;
    protected: number;
  };
  occurrences: Array<{ start_at: string; end_at: string; action: string }>;
  removals: Array<{ session_id: string; start_at: string; end_at: string; action: string }>;
  conflicts: Array<{ type: string; message: string }>;
}
