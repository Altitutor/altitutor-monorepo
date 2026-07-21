export interface AvailableSlot {
  start_at: string;
  end_at: string;
  available_staff_ids: string[];
  is_available: boolean;
}

export interface GetAvailableSlotsParams {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  session_type: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  subject_id?: string;
  duration_minutes?: number;
}

export const availabilityApi = {
  async getAvailableSlots(params: GetAvailableSlotsParams): Promise<AvailableSlot[]> {
    const query = new URLSearchParams({
      start_date: params.start_date,
      end_date: params.end_date,
      session_type: params.session_type,
      ...(params.subject_id ? { subject_id: params.subject_id } : {}),
      ...(params.duration_minutes ? { duration_minutes: String(params.duration_minutes) } : {}),
    });
    const response = await fetch(`/api/bookings/availability?${query.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch availability');
    return await response.json() as AvailableSlot[];
  },
};
