'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Check, Calendar, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { formatSubjectDisplay, getSubjectColorStyle, formatSessionType, cn } from '@/shared/utils';
import { VENUE_ADDRESS, CONTACT_PHONE, CONTACT_EMAIL } from '@/shared/constants';
import { downloadCalendarEvent } from '@/shared/utils/calendar';
import type { Tables } from '@altitutor/shared';

// Dynamically import VenueMap to avoid SSR issues with Leaflet
const VenueMap = dynamic(() => import('@/shared/components/VenueMap').then(mod => ({ default: mod.VenueMap })), {
  ssr: false,
  loading: () => <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
});

interface BookingData {
  session_id: string;
  session_type?: string;
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
  const searchParams = useSearchParams();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    
    // Try to get booking data from sessionStorage first
    const storedData = sessionStorage.getItem('trial_booking_data');
    
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

    // If no stored data but we have a sessionId, fetch from API
    if (sessionId) {
      fetch(`/api/bookings/trial/${sessionId}`)
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error('Session not found');
            }
            throw new Error('Failed to fetch booking data');
          }
          const data = await response.json();
          setBookingData(data);
        })
        .catch((error) => {
          console.error('Failed to fetch booking data:', error);
          // Keep loading state false to show error message
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // No sessionId and no stored data
      setIsLoading(false);
    }
  }, [searchParams]);

  // Move useMemo before early returns to follow Rules of Hooks
  const sessionDate = useMemo(() => {
    if (!bookingData) return null;
    const sessionStart = parseISO(bookingData.start_at);
    const date = new Date(sessionStart);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [bookingData]);

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

  if (!bookingData || !sessionDate) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground">Unable to load booking details.</p>
            <p className="text-sm text-muted-foreground mt-2">
              If you just completed a booking, please check your email for confirmation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sessionStart = parseISO(bookingData.start_at);
  const sessionEnd = parseISO(bookingData.end_at);

  const durationMinutes = differenceInMinutes(sessionEnd, sessionStart);
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;
  const durationDisplay = durationHours > 0 
    ? `${durationHours} hour${durationHours !== 1 ? 's' : ''}${durationMins > 0 ? ` ${durationMins} minute${durationMins !== 1 ? 's' : ''}` : ''}`
    : `${durationMinutes} minutes`;

  // Calculate time range: 2 hours before and 2 hours after session
  const sessionStartHour = sessionStart.getHours();
  const sessionEndHour = sessionEnd.getHours();
  
  // Calculate start time (2 hours before session start)
  const minHour = Math.max(0, sessionStartHour - 2);
  
  // Calculate end time (2 hours after session end)
  const maxHour = Math.min(23, sessionEndHour + 2);
  
  // Create slots array (every hour)
  const slots: number[] = [];
  for (let hour = minHour; hour <= maxHour; hour++) {
    slots.push(hour);
  }
  
  const slotHeight = 75; // px per hour
  const minutesFromStart = (date: Date) => {
    const hours = date.getHours() - minHour;
    const minutes = date.getMinutes();
    return hours * 60 + minutes;
  };
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
          {bookingData.session_type 
            ? `Your ${formatSessionType(bookingData.session_type).toLowerCase()} has been successfully booked`
            : 'Your session has been successfully booked'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Booking Details */}
        <div className="space-y-6">
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
                        <div className="flex flex-wrap gap-2 mb-2">
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
                        <div className="text-xs text-muted-foreground">
                          {bookingData.subjects.map(s => formatSubjectDisplay(s)).join(', ')}
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="text-sm font-medium text-muted-foreground">Date:</div>
                  <div className="text-sm">
                    {format(sessionStart, 'EEEE, dd MMMM yyyy')}
                  </div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Time:</div>
                  <div className="text-sm">
                    {format(sessionStart, 'h:mm a')} - {format(sessionEnd, 'h:mm a')}
                  </div>
                  
                  <div className="text-sm font-medium text-muted-foreground">Duration:</div>
                  <div className="text-sm">{durationDisplay}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Office Address:</p>
                  <p className="text-sm text-muted-foreground">{VENUE_ADDRESS}</p>
                </div>
                <div className="rounded-lg overflow-hidden">
                  <VenueMap height="300px" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Calendar</CardTitle>
              <Button
                onClick={() => downloadCalendarEvent(bookingData)}
                variant="outline"
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Add to Calendar
              </Button>
            </div>
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
                            <div className="text-xs font-semibold mb-1">
                              {bookingData.session_type 
                                ? formatSessionType(bookingData.session_type)
                                : 'Session'}
                            </div>
                            <div className="text-xs">
                              {format(sessionStart, 'h:mm a')} - {format(sessionEnd, 'h:mm a')}
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

      {/* Contact Altitutor Card */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Altitutor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <a href={`tel:${CONTACT_PHONE}`} className="text-sm text-muted-foreground hover:underline">
                    {CONTACT_PHONE}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-muted-foreground hover:underline">
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
