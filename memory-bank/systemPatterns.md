# System Patterns

## Architecture Patterns

### Frontend Patterns

#### Component Architecture
- **Atomic Design**: Components organized as atoms, molecules, organisms, templates, and pages
- **UI Component Library**: Using shadcn/ui for consistent design
- **Component Co-location**: Feature-specific components kept together with their functionality

#### State Management
- **Server State**: TanStack React Query for server state and caching
- **Client State**: Zustand for global client-side state
- **Form State**: React Hook Form for form state management
- **Validation**: Zod for schema validation and type safety

#### Routing & Navigation
- **Next.js App Router**: Using the latest Next.js App Router for routing
- **Layout Pattern**: Consistent layouts across routes using layout components
- **Route Groups**: Organized routes by feature area

### Backend Patterns

#### Data Access
- **Repository Pattern**: Centralized data access through repository functions
- **Row-Level Security**: Using Supabase RLS for data protection
- **Data Validation**: Server-side validation with Zod schemas

#### Authentication & Authorization
- **Role-Based Access Control**: Permissions based on user roles
- **JWT Authentication**: Using Supabase JWT tokens
- **Protected Routes**: Route protection based on authentication and authorization

#### API Design
- **REST API Conventions**: Following RESTful principles for API endpoints
- **Error Handling**: Consistent error response format
- **Pagination**: Standard pagination patterns for list endpoints

## Template & Automation Patterns

### Message Template System
- **Template Repository**: Centralized storage of message templates
- **Variable Interpolation**: Dynamic variable substitution in templates
- **Template Selection**: Context-aware template selection based on event type
- **Preview & Edit**: Template preview with ability to edit before sending

### Workflow Automation
- **Event-Driven Actions**: Trigger workflows based on specific events
- **Task Generation**: Automatic task creation for administrative processes
- **Status Tracking**: Workflow state management with status updates
- **Notification System**: Automated alerts for key workflow steps

### Form Generation
- **Dynamic Forms**: Context-aware form generation based on entity type
- **Field Validation**: Consistent validation rules across forms
- **Multi-step Forms**: Support for wizard-style form completion
- **Prefill Capabilities**: Auto-populate forms with existing data when editing

## Feature-Specific Patterns

### Student Management
- **Student Record Pattern**: Comprehensive student profile with related data
- **Enrollment Tracking**: Record of all class enrollments with history
- **Communication Log**: Centralized history of all communications
- **Attendance Record**: Comprehensive attendance tracking

### Staff Management
- **Staff Profile Pattern**: Complete staff record with qualifications and feedback
- **Shift Assignment**: Flexible scheduling system for staff
- **Substitution Management**: Process for handling shift swaps
- **Performance Tracking**: Record of feedback and performance notes

### Class Management
- **Class Schedule Pattern**: Consistent representation of recurring classes
- **Enrollment Management**: Tools for adding/removing students
- **Capacity Tracking**: Monitoring of class sizes
- **Session Record**: Detailed information about each class session

### Absence Management
- **Absence Classification**: Categorization of absences (planned, unexplained)
- **Notification Workflow**: Automated communication about absences
- **Resolution Tracking**: Recording of absence resolution (credit, reschedule)
- **Reporting System**: Analytics on absences and patterns

### Messaging System
- **SMS Integration**: Service for sending text messages
- **Template Engine**: System for template management and rendering
- **Variable Substitution**: Dynamic content insertion
- **Click-to-Message**: Direct messaging from student/staff profiles

## Code Organization

### Directory Structure
```
src/
├── app/                   # Next.js app router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── students/      # Student management
│   │   ├── staff/         # Staff management
│   │   ├── classes/       # Class management
│   │   ├── sessions/      # Session management
│   │   ├── absences/      # Absence management
│   │   ├── messages/      # Message system
│   │   ├── drafting/      # Drafting session management
│   │   ├── projects/      # Project management
│   │   └── reports/       # Reports and analytics
│   └── api/               # API routes
├── components/            # Shared UI components
│   ├── ui/                # Base UI components
│   ├── forms/             # Form components
│   │   ├── students/      # Student-related forms
│   │   ├── staff/         # Staff-related forms
│   │   ├── classes/       # Class-related forms
│   │   ├── absences/      # Absence-related forms
│   │   └── messages/      # Message-related forms
│   ├── layouts/           # Layout components
│   ├── dashboard/         # Dashboard components
│   ├── tables/            # Table components
│   ├── modals/            # Modal components
│   └── messaging/         # Messaging components
├── lib/                   # Utility functions and shared logic
│   ├── supabase/          # Supabase client and utilities
│   ├── utils/             # General utilities
│   ├── validators/        # Validation schemas
│   ├── dates/             # Date formatting utilities
│   ├── messaging/         # Messaging utilities
│   └── templates/         # Message template utilities
├── types/                 # TypeScript type definitions
├── store/                 # Zustand store definitions
├── hooks/                 # Custom React hooks
│   ├── use-students.ts    # Student-related hooks
│   ├── use-staff.ts       # Staff-related hooks
│   ├── use-classes.ts     # Class-related hooks
│   ├── use-absences.ts    # Absence-related hooks
│   └── use-messages.ts    # Message-related hooks
└── templates/             # Message templates
    ├── student/           # Student message templates
    ├── staff/             # Staff message templates
    ├── absence/           # Absence message templates
    └── class/             # Class message templates
```

### Naming Conventions
- **Files**: kebab-case for files (e.g., `student-form.tsx`)
- **Components**: PascalCase for component names (e.g., `StudentForm`)
- **Functions**: camelCase for functions (e.g., `getStudentById`)
- **Types/Interfaces**: PascalCase with descriptive names (e.g., `StudentWithClasses`)
- **Template Files**: kebab-case with descriptive names (e.g., `trial-session-confirmation.ts`)

## Design Patterns for Key Features

### Template-based Messaging
- **Template Repository**: Central store of all message templates
- **Variable Parser**: System for parsing and replacing template variables
- **Contact Resolution**: System for resolving contact details from entities
- **Preview Component**: UI for previewing composed messages
- **Message History**: Record of all sent messages with template reference

**Example Workflow**:
1. Select entity (student/staff)
2. Choose appropriate message template
3. Auto-populate template with entity data
4. Preview rendered message
5. Edit if needed
6. Send and record in history

### Student Enrollment Management
- **Class Finder**: System for finding appropriate classes
- **Enrollment Creator**: Logic for creating enrollment records
- **Capacity Checker**: Verification of class capacity
- **Notification Trigger**: Automatic notification of enrollment changes

**Example Workflow**:
1. Select student
2. View available classes
3. Select class for enrollment
4. Confirm enrollment details (start date, etc.)
5. Create enrollment record
6. Send confirmation message

### Absence Management
- **Absence Logger**: System for recording absence details
- **Resolution Tracker**: Logic for handling absence resolution
- **Communication Trigger**: Automatic communication about absences
- **Reporting Component**: UI for viewing absence patterns

**Example Workflow**:
1. Record student absence with details (date, reason)
2. Generate confirmation message
3. Track resolution (credit, reschedule)
4. Update attendance records

### Staff Shift Management
- **Shift Finder**: System for identifying staff shifts
- **Substitute Matcher**: Logic for finding appropriate substitutes
- **Notification System**: Automatic alerts to affected staff
- **Shift Record**: Documentation of all shift changes

**Example Workflow**:
1. Identify shift needing substitution
2. Find available substitute staff
3. Create shift swap record
4. Notify both normal and substitute staff
5. Update class assignments

### Special Session Booking
- **Session Scheduler**: System for booking special sessions
- **Availability Checker**: Verification of time slot availability
- **Confirmation Generator**: Automatic confirmation messages
- **Payment Processor**: Integration with payment system

**Example Workflow**:
1. Select session type (English, Assignment)
2. Choose available time slot
3. Create session record
4. Generate confirmation message
5. Process payment if required

## Form Handling
- Standard form patterns with React Hook Form and Zod validation
- Reusable form components for common input types
- Form state persistence for multi-step forms
- Dynamic validation based on context

## Data Fetching
- Centralized data fetching with React Query
- Consistent loading, error, and success states
- Optimistic updates for improved UX
- Prefetching for common navigation paths

## Error Handling
- Global error boundary for client-side errors
- Consistent error messaging
- Detailed logging for debugging
- Fallback UI for data loading failures

## Responsive Design
- Mobile-first approach
- Tailwind breakpoints for consistent responsive behavior
- Adaptive layouts for different screen sizes
- Priority content identification for small screens 