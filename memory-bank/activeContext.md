# Active Context

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