import { ICalendar } from 'datebook';
import { VENUE_ADDRESS, CONTACT_PHONE, CONTACT_EMAIL } from '../constants';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay } from './index';

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

export function generateCalendarEvent(bookingData: BookingData): string {
  const startDate = new Date(bookingData.start_at);
  const endDate = new Date(bookingData.end_at);

  // Build description with contact info and booking details
  // Check subjects array first, then fall back to subject_ids count
  const subjectList = bookingData.subjects && Array.isArray(bookingData.subjects) && bookingData.subjects.length > 0
    ? bookingData.subjects.map(s => formatSubjectDisplay(s)).join(', ')
    : bookingData.subject_ids && Array.isArray(bookingData.subject_ids) && bookingData.subject_ids.length > 0
    ? `${bookingData.subject_ids.length} subject${bookingData.subject_ids.length !== 1 ? 's' : ''} selected`
    : 'No subjects specified';

  const yearLevelDisplay = bookingData.year_level 
    ? bookingData.year_level === 'Reception' || bookingData.year_level === 0
      ? 'Reception'
      : `Year ${bookingData.year_level}`
    : 'Not specified';

  // Get base URL dynamically - use window.location.origin if available (client-side),
  // otherwise fall back to environment variable or default
  const getBaseUrl = (): string => {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_STUDENT_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://student.altitutor.com';
  };

  const bookingUrl = `${getBaseUrl()}/booking-success?sessionId=${bookingData.session_id}`;

  const description = `Contact Altitutor at:
${CONTACT_PHONE}
${CONTACT_EMAIL}

Booking Details:
Student: ${bookingData.student_first_name} ${bookingData.student_last_name}
Email: ${bookingData.student_email}
${bookingData.student_phone ? `Phone: ${bookingData.student_phone}` : ''}
Curriculum: ${bookingData.curriculum}
Year Level: ${yearLevelDisplay}
Subjects: ${subjectList}

View booking online: ${bookingUrl}`;

  const event = {
    title: 'Altitutor New Student Trial Session',
    location: VENUE_ADDRESS,
    description,
    start: startDate,
    end: endDate,
  };

  const icalendar = new ICalendar(event);
  return icalendar.render();
}

export function downloadCalendarEvent(bookingData: BookingData): void {
  const icsContent = generateCalendarEvent(bookingData);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `altitutor-trial-session-${bookingData.session_id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
