# Active Development Context

## Current Focus Areas

### Database Schema Implementation
We've completed the database schema implementation through a series of migrations:

1. Initial schema creation (20250426130921_initial_schema.sql)
   - Created core tables: students, staff, classes, etc.
   - Set up initial relationships and constraints
   - Added basic RLS policies

2. Schema updates (20250427000000_schema_updates.sql)
   - Enhanced students table with additional fields
   - Created subjects table and related tables
   - Added many-to-many relationships (students_subjects, staff_subjects)
   - Created resource_files tables

3. Custom claim-based RLS (20250428000000_custom_claim_based_rls.sql)
   - Implemented custom claim-based RLS
   - Created helper functions for permission checks
   - Enhanced security with user role-based access

4. User role claim system (20250428000001_add_user_role_claim.sql)
   - Added user_role claim to users
   - Set up user role enforcement
   - Configured roles: ADMINSTAFF, TUTOR, STUDENT

5. Staff availability (20250428000002_add_staff_availability.sql)
   - Added availability tracking to staff table

### Next Implementation Priorities

1. Subjects Management
   - Create UI for adding/editing subjects in settings

2. User Registration Forms
   - Student registration with multi-select subjects
   - Tutor registration with multi-select subjects
   - Admin staff registration with multi-select subjects
   - Public-facing UI for these forms

3. UI Enhancement
   - Complete data tables with filtering and sorting
   - Calendar view for classes

4. Workflow Implementation
   - Planned absences
   - Class changes
   - Session bookings
   - Staff shift management

## Development Approach

### UI Implementation
- Create consistent form patterns for all registration types
- Use multi-select components for subject selection
- Ensure proper user role assignment during registration
- Build responsive tables with filtering capabilities

### Workflow Implementation
- Use step-by-step wizards for complex workflows
- Implement validation at each step
- Keep track of workflow progress
- Support aborting and resuming workflows

## Current Challenges

- Designing intuitive registration forms for different user types
- Implementing proper validation for multi-step workflows
- Managing complex relationships between tables
- Ensuring proper user role assignment and permissions

## Recent Decisions

- Using custom claims for role-based access control
- Implementing staff availability tracking similar to student availability
- Separating admin staff and tutors as different roles
- Creating specialized workflows for different scenarios

## Current Development Focus
The project is in the early stages of development, with the following areas as the current focus:

1. **Database Schema Design**: Finalizing the Supabase database schema for core entities
2. **Authentication System**: Completing the Supabase authentication setup
3. **Core UI Components**: Setting up the foundational UI components and layouts
4. **Message Template System**: Designing the template system for dynamic messaging

## Current Implementation Status

### Completed
- Next.js project initialization
- Basic Supabase authentication setup
- Initial UI component library configuration (shadcn/ui)
- Project structure and architecture decisions

### In Progress
- Database schema design and implementation
- Authentication flow completion
- Dashboard layout and navigation
- Base entity models and types
- Message template system design

### Blocked/Issues
- SMS service provider selection and integration
- Mobile number formatting and validation across regions

## Immediate Next Steps
1. Complete the Supabase database schema design for core entities
2. Implement basic CRUD operations for students, staff, and classes
3. Create message template system with variable substitution
4. Create dashboard layout and navigation structure
5. Set up protected routes with authentication
6. Implement student management functionality

## Key Features to Implement First
1. **Student Management**:
   - Student profiles with contact information
   - Class enrollment functionality
   - Student history tracking

2. **Message Template System**:
   - Template repository with variable placeholders
   - Dynamic content substitution
   - Preview and sending functionality

3. **Class Management**:
   - Class creation and scheduling
   - Student enrollment in classes
   - Staff assignment to classes

4. **Absence Management**:
   - Recording of planned and unexplained absences
   - Automated messaging for absences
   - Resolution tracking (credit/reschedule)

## Technical Decisions

### Recent Decisions
- Using Supabase for authentication and database
- Adopting shadcn/ui for component library
- Implementing Zustand for state management
- Using React Query for data fetching and caching
- Implementing a dynamic message template system with variable substitution

### Pending Decisions
- SMS service provider selection for messaging integration
- Approach for handling file uploads and document storage
- Strategy for implementing real-time features
- Method for handling notifications (in-app vs. email)
- Deployment strategy and CI/CD pipeline setup

## Development Priorities (Next 2 Weeks)
1. Complete database schema and initial migrations
2. Implement authentication flows and user management
3. Create core dashboard experience with navigation
4. Build message template system framework
5. Implement student management CRUD operations
6. Create basic class management functionality
7. Develop initial absence tracking system

## UI Component Needs
1. **Message Templates**:
   - Template editor
   - Template preview
   - Variable selector
   - Message history viewer
   
2. **Student Management**:
   - Student registration form
   - Student detail view
   - Class enrollment interface
   - Absence recording interface
   
3. **Class Management**:
   - Class creation form
   - Class schedule view
   - Student enrollment interface
   - Staff assignment interface 