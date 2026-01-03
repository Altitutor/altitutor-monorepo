'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isSameDay, differenceInMinutes } from 'date-fns';
import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { formatSubjectDisplay, getSubjectColorStyle, cn } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';

interface BookingData {
  session_id: string;
  start_at: string;
  end_at: string;
  student_first_name: string;
  student_last_name: string;
  student_email: string;
  student_phone?: string;
  curriculum: string;
  year_level?: string | number;
  subject_ids?: string[];
  subjects?: Tables<'subjects'>[];
}

export default function BookingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    
    // Try to get booking data from sessionStorage
    const storedData = sessionStorage.getItem('trial_booking_data');
    
    if (!sessionId && !storedData) {
      // No session ID and no stored data - redirect to book-trial
      router.push('/booking/trial-session');
      return;
    }

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        // Verify sessionId matches if provided
        if (!sessionId || parsed.session_id === sessionId) {
          setBookingData(parsed);
          setIsLoading(false);
          // Clear the stored data after reading
          sessionStorage.removeItem('trial_booking_data');
          return;
        }
      } catch (e) {
        console.error('Failed to parse stored booking data:', e);
      }
    }

    // If we have sessionId but no stored data, we could fetch from API
    // For now, redirect to book-trial if no stored data
    if (sessionId && !storedData) {
      router.push('/booking/trial-session');
      return;
    }

    setIsLoading(false);
  }, [searchParams, router]);

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground">Loading booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!bookingData) {
    return null; // Will redirect
  }

  const sessionStart = parseISO(bookingData.start_at);
  const sessionEnd = parseISO(bookingData.end_at);
  const sessionDate = useMemo(() => {
    const date = new Date(sessionStart);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [sessionStart]);

  const durationMinutes = differenceInMinutes(sessionEnd, sessionStart);
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;
  const durationDisplay = durationHours > 0 
    ? `${durationHours} hour${durationHours !== 1 ? 's' : ''}${durationMins > 0 ? ` ${durationMins} minute${durationMins !== 1 ? 's' : ''}` : ''}`
    : `${durationMinutes} minutes`;

  // Calculate dynamic time range based on session
  const sessionStartHour = sessionStart.getHours();
  const sessionEndHour = sessionEnd.getHours();
  const minHour = Math.max(0, Math.min(9, sessionStartHour - 1)); // Start at 9am or 1 hour before session
  const maxHour = Math.min(23, Math.max(20, sessionEndHour + 1)); // End at 8pm or 1 hour after session
  const slotCount = maxHour - minHour + 1;
  const slots = Array.from({ length: slotCount }, (_, i) => minHour + i);
  const slotHeight = 75; // px per hour
  const minutesFromStart = (date: Date) => (date.getHours() * 60 + date.getMinutes()) - (minHour * 60);
  const top = Math.max(0, (minutesFromStart(sessionStart) / 60) * slotHeight);
  const height = Math.max(45, (durationMinutes / 60) * slotHeight);

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-muted-foreground">
          Your trial session has been successfully booked
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Session Details */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="text-sm font-medium text-muted-foreground">Student:</div>
                <div className="text-sm">
                  {bookingData.student_first_name} {bookingData.student_last_name}
                </div>
                
                <div className="text-sm font-medium text-muted-foreground">Email:</div>
                <div className="text-sm">{bookingData.student_email}</div>
                
                {bookingData.student_phone && (
                  <>
                    <div className="text-sm font-medium text-muted-foreground">Phone:</div>
                    <div className="text-sm">{bookingData.student_phone}</div>
                  </>
                )}
                
                <div className="text-sm font-medium text-muted-foreground">Curriculum:</div>
                <div className="text-sm">
                  {bookingData.curriculum}
                  {bookingData.year_level && ` - Year ${bookingData.year_level === 'Reception' || bookingData.year_level === 0 ? 'Reception' : bookingData.year_level}`}
                </div>
                
                {bookingData.subjects && bookingData.subjects.length > 0 && (
                  <>
                    <div className="text-sm font-medium text-muted-foreground">Subjects:</div>
                    <div className="text-sm">
                      <div className="flex flex-wrap gap-2">
                        {bookingData.subjects.map((subject) => {
                          const { style, textColorClass } = getSubjectColorStyle(subject);
                          const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                          return (
                            <Badge
                              key={subject.id}
                              className={cn(
                                defaultClass || `${textColorClass} border-0`,
                                !defaultClass && 'border-0'
                              )}
                              style={style.backgroundColor ? style : undefined}
                            >
                              {formatSubjectDisplay(subject)}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                
                <div className="text-sm font-medium text-muted-foreground">Date:</div>
                <div className="text-sm">
                  {format(sessionStart, 'EEEE, dd MMMM yyyy', { timeZone: 'Australia/Adelaide' })}
                </div>
                
                <div className="text-sm font-medium text-muted-foreground">Time:</div>
                <div className="text-sm">
                  {format(sessionStart, 'h:mm a', { timeZone: 'Australia/Adelaide' })} - {format(sessionEnd, 'h:mm a', { timeZone: 'Australia/Adelaide' })}
                </div>
                
                <div className="text-sm font-medium text-muted-foreground">Duration:</div>
                <div className="text-sm">{durationDisplay}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex-1 overflow-auto relative border rounded-lg">
              <div
                className="grid gap-0 min-h-full relative bg-background"
                style={{ gridTemplateColumns: `minmax(80px, 100px) minmax(150px, 1fr)` }}
              >
                {/* Headers */}
                <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-xs">
                  Time
                </div>
                <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r text-sm">
                  {format(sessionDate, 'EEE dd MMM')}
                </div>

                {/* Rows */}
                {slots.map((hour, idx) => (
                  <div key={hour} className="contents">
                    <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
                      {format(new Date(2000, 0, 1, hour, 0), 'h a')}
                    </div>
                    <div className="relative border-b border-r h-[75px] bg-background">
                      {idx === 0 && (
                        <div className="absolute inset-0" style={{ height: `${slots.length * slotHeight}px` }}>
                          <div
                            className="absolute bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-2 rounded shadow-md border-2 border-green-300 dark:border-green-700"
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: '2.5%',
                              width: '95%',
                              zIndex: 20,
                              minHeight: '45px',
                            }}
                          >
                            <div className="text-xs font-semibold mb-1">Trial Session</div>
                            <div className="text-xs">
                              {format(sessionStart, 'h:mm a', { timeZone: 'Australia/Adelaide' })} - {format(sessionEnd, 'h:mm a', { timeZone: 'Australia/Adelaide' })}
                            </div>
                            {bookingData.subjects && bookingData.subjects.length > 0 && (
                              <div className="text-xs mt-1 opacity-80">
                                {bookingData.subjects.map(s => formatSubjectDisplay(s)).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
