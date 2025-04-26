# Technical Context

## Architecture Overview
The Altitutor Admin App follows a modern web application architecture with a clear separation of concerns:

1. **Frontend**: Next.js React application with server components and client components where needed
2. **Backend**: Supabase for authentication, database, storage, and serverless functions
3. **API Layer**: Next.js API routes where needed for custom business logic
4. **Integration**: SMS service integration for automated communications

## Key Technologies

### Frontend
- **Next.js**: Framework for server-side rendering, static site generation, and API routes
- **React**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on top of Radix UI
- **Zustand**: Lightweight state management
- **React Query**: Data fetching and caching
- **React Hook Form**: Form handling
- **Zod**: Schema validation
- **React Big Calendar**: Calendar component for scheduling
- **Lucide React**: Icon library

### Backend
- **Supabase**: Backend as a service
  - **Authentication**: User management and authentication
  - **PostgreSQL Database**: Relational database for data storage
  - **Storage**: File storage for documents and media
  - **Edge Functions**: Serverless functions for custom logic

### Integration
- **SMS Provider**: API integration for sending text messages
- **Email Service**: For notifications and communications
- **Calendar Integration**: For scheduling and reminders

### Testing & Quality
- **Jest**: Unit and integration testing
- **Playwright**: End-to-end testing
- **Storybook**: Component development and documentation
- **ESLint**: Code linting
- **TypeScript**: Type safety

## Database Schema (Comprehensive)

### Core Entities

#### Users Table
- id (UUID, PK)
- email (TEXT)
- auth_id (UUID) - Link to Supabase auth
- role (TEXT) - 'ADMIN', 'TUTOR', 'STUDENT'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### Students Table
- id (UUID, PK)
- first_name (TEXT)
- last_name (TEXT)
- email (TEXT)
- phone_number (TEXT)
- parent_name (TEXT)
- parent_email (TEXT)
- parent_phone (TEXT)
- status (TEXT) - 'CURRENT', 'INACTIVE', 'TRIAL', 'DISCONTINUED'
- notes (TEXT)
- user_id (UUID, FK) - Optional link to users table
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### Staff Table
- id (UUID, PK)
- first_name (TEXT)
- last_name (TEXT)
- email (TEXT)
- phone_number (TEXT)
- role (TEXT) - 'ADMIN', 'TUTOR'
- status (TEXT) - 'ACTIVE', 'INACTIVE', 'TRIAL'
- notes (TEXT)
- has_office_keys (BOOLEAN)
- has_parking_remote (BOOLEAN)
- user_id (UUID, FK)
- last_feedback_date (DATE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### Classes Table
- id (UUID, PK)
- subject (TEXT)
- day_of_week (INTEGER) - 0-6 for Sunday-Saturday
- start_time (TEXT)
- end_time (TEXT)
- max_capacity (INTEGER)
- status (TEXT) - 'ACTIVE', 'INACTIVE', 'FULL'
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Relationships

#### ClassEnrollments Table
- id (UUID, PK)
- student_id (UUID, FK)
- class_id (UUID, FK)
- start_date (TEXT)
- end_date (TEXT)
- status (TEXT) - 'ACTIVE', 'DISCONTINUED', 'TRIAL'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### ClassAssignments Table
- id (UUID, PK)
- staff_id (UUID, FK)
- class_id (UUID, FK)
- start_date (TEXT)
- end_date (TEXT)
- is_substitute (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### ShiftSwaps Table
- id (UUID, PK)
- assignment_id (UUID, FK)
- normal_tutor_id (UUID, FK)
- substitute_tutor_id (UUID, FK)
- date (TEXT)
- classes (TEXT[]) - Array of affected classes
- reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Administrative Records

#### Absences Table
- id (UUID, PK)
- student_id (UUID, FK)
- class_id (UUID, FK)
- date (TEXT)
- type (TEXT) - 'PLANNED', 'UNPLANNED'
- reason (TEXT)
- is_rescheduled (BOOLEAN)
- rescheduled_date (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### Meetings Table
- id (UUID, PK)
- student_id (UUID, FK)
- staff_id (UUID, FK)
- date (TEXT)
- time (TEXT)
- type (TEXT) - 'TRIAL_SESSION', 'SUBSIDY_INTERVIEW', 'PARENT_MEETING', 'OTHER'
- notes (TEXT)
- outcome (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### DraftingSessions Table
- id (UUID, PK)
- student_id (UUID, FK)
- date (TEXT)
- time (TEXT)
- type (TEXT) - 'ENGLISH', 'ASSIGNMENT'
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### Sessions Table
- id (UUID, PK)
- date (TEXT)
- type (TEXT) - 'CLASS', 'DRAFTING', 'SUBSIDY_INTERVIEW', 'TRIAL_SESSION', 'TRIAL_SHIFT'
- subject (TEXT)
- class_id (UUID, FK)
- staff_id (UUID, FK)
- teaching_content (TEXT)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### SessionAttendances Table
- id (UUID, PK)
- session_id (UUID, FK)
- student_id (UUID, FK)
- attended (BOOLEAN)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### StaffTrialShifts Table
- id (UUID, PK)
- staff_id (UUID, FK)
- date (TEXT)
- classes (TEXT[]) - Array of classes covered
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Communication

#### Messages Table
- id (UUID, PK)
- student_id (UUID, FK)
- staff_id (UUID, FK)
- recipient_type (TEXT) - 'STUDENT', 'PARENT', 'STAFF'
- type (TEXT) - 'EMAIL', 'SMS', 'INTERNAL_NOTE'
- content (TEXT)
- template_used (TEXT)
- status (TEXT) - 'DRAFT', 'SENT', 'FAILED'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### MessageTemplates Table
- id (UUID, PK)
- name (TEXT)
- type (TEXT) - 'ABSENCE', 'TRIAL', 'CLASS_CHANGE', etc.
- content (TEXT)
- variables (TEXT[]) - Array of variable placeholders
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Project Management

#### Projects Table
- id (UUID, PK)
- name (TEXT)
- status (TEXT) - 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'
- department (TEXT)
- project_lead (UUID, FK to staff)
- people (TEXT[])
- priority (INTEGER)
- date_started (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### Tasks Table
- id (UUID, PK)
- title (TEXT)
- description (TEXT)
- status (TEXT) - 'TODO', 'IN_PROGRESS', 'COMPLETED'
- assigned_to (UUID, FK to staff)
- project_id (UUID, FK)
- due_date (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## Application Features

### Message Template System
- Dynamic templates with variable substitution
- Context-aware message generation based on event type
- Support for SMS and email formats
- Click-to-message functionality

### Student Management System
- Complete student lifecycle management
- Trial session scheduling and tracking
- Class enrollment and attendance tracking
- Communication history and parent contact management

### Staff Management System
- Tutor scheduling and shift management
- Trial shift assignment and feedback collection
- Substitute teacher management
- Performance tracking

### Class and Session Management
- Class scheduling with time slots
- Student enrollment in classes
- Session attendance tracking
- Absence management and rescheduling

### Administrative Workflows
- Absence handling with automatic message generation
- Trial session booking and confirmation
- Student registration and class assignment
- Subsidy interview scheduling
- Assignment drafting session booking

## Integration Points

### SMS Provider Integration
- API integration for sending text messages
- Template-based message generation
- Mobile number validation and formatting

### Calendar Integration
- Schedule visualization
- Appointment booking interface
- Conflict detection

### Email Service Integration
- Template-based email messaging
- Attachments handling
- HTML formatting support

## Deployment Strategy
- **Development**: Local development with Supabase local emulator
- **Staging**: Vercel preview deployments with staging Supabase instance
- **Production**: Vercel production deployment with production Supabase instance

## Security Considerations
- Row-level security in Supabase for data protection
- Role-based access control
- Secure authentication flows
- Environment variable management for sensitive information
- Secure storage of communication credentials 