// App metadata
export const APP_NAME = 'AltiTutor Admin';
export const APP_DESCRIPTION = 'A comprehensive CRM system for Altitutor\'s administrative staff';

// API endpoints
export const API_BASE_URL = '/api';

// Navigation
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  STUDENTS: '/dashboard/students',
  STAFF: '/dashboard/staff',
  CLASSES: '/dashboard/classes',
  SESSIONS: '/dashboard/sessions',
  SETTINGS: '/dashboard/settings',
};

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

// Date formats
export const DATE_FORMAT = 'dd MMM yyyy';
export const DATE_TIME_FORMAT = 'dd MMM yyyy HH:mm';

// Theme
export const THEME_LOCAL_STORAGE_KEY = 'altitutor-theme';

// Venue information
export const VENUE_ADDRESS = 'Level 1 / 17A Solomon St, Adelaide SA 5000, Australia';
export const VENUE_COORDINATES = {
  lat: -34.924080,
  lng: 138.596008,
};

// Contact information
export const CONTACT_PHONE = '+61 483 849 842';
export const CONTACT_EMAIL = 'admin@altitutor.com';
export const CONTACT_NO_SLOTS_MESSAGE =
  'No sessions available? Get in contact, and we will book you in.';