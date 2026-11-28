"use client";

import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { BUSINESS_TIMEZONE } from "@altitutor/shared";
import { adelaideWallDateTimeToUtcIso, utcToAdelaideDate } from "@/features/bookings/utils/dateTimeHelpers";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { formatSessionType } from "@/shared/utils";
import { useInterviewRoundEvents } from "../hooks/useInterviewRoundEvents";
import { SessionDay } from "./SessionDay";

export function DaySessionPreview({ date }: { date: string }) {
  const day = new Date(`${date}T12:00:00`);
  const previousDay = format(addDays(day, -1), "yyyy-MM-dd");
  const nextDay = format(addDays(day, 1), "yyyy-MM-dd");
  const sessions = useQuery({
    queryKey: ["admin-day-session-preview", date],
    queryFn: async ({ signal }) => {
      const start = adelaideWallDateTimeToUtcIso(date, "00:00");
      const end = adelaideWallDateTimeToUtcIso(nextDay, "00:00");
      const { data, error } = await getSupabaseClient()
        .from("sessions")
        .select("id,short_name,long_name,type,start_at")
        .eq("status", "ACTIVE")
        .is("calendar_tombstone_until", null)
        .gte("start_at", start)
        .lt("start_at", end)
        .order("start_at")
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
  // The round query receives local date bounds, so also read the adjacent days
  // and then keep the events on the requested Adelaide business day.
  const rounds = useInterviewRoundEvents(previousDay, nextDay);
  const items = [
    ...(sessions.data ?? []).map(session => ({
      id: session.id,
      label: session.short_name || session.long_name || formatSessionType(session.type),
      startsAt: session.start_at,
    })),
    ...(rounds.data ?? []).filter(round => utcToAdelaideDate(round.scheduledAt) === date).map(round => ({
      id: `round:${round.id}`,
      label: round.name,
      startsAt: round.scheduledAt,
    })),
  ];
  const heading = format(day, "EEEE, d MMMM");

  return (
    <section aria-label={`Day preview for ${heading}`}>
      <h3 className="mb-2 text-sm font-medium">{heading}</h3>
      {sessions.isError || rounds.isError ? (
        <p role="status" className="mb-2 text-xs text-muted-foreground">Some sessions could not be loaded.</p>
      ) : null}
      {sessions.isPending || rounds.isPending ? (
        <p role="status" className="mb-2 text-xs text-muted-foreground">Loading sessions…</p>
      ) : null}
      {items.length || (!sessions.isPending && !rounds.isPending && !sessions.isError && !rounds.isError)
        ? <SessionDay items={items} timezone={BUSINESS_TIMEZONE} />
        : null}
    </section>
  );
}
