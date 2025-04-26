# Altitutor Admin App - Project Brief

## Overview
The Altitutor Admin App is a custom CRM system designed for Altitutor's administrative staff to manage various aspects of their operations, including students, staff, classes, sessions, and communication. This application aims to replicate and enhance the functionality previously available in a custom Obsidian vault.

## Core Requirements

### User Management
- Manage student profiles and information (contact details, subjects, status)
- Manage staff/tutor profiles (contact details, shifts, availability, feedback)
- Role-based access control (admin, staff)
- User authentication via Supabase

### Educational Management
- Class scheduling and management with day/time details
- Session tracking and attendance reporting
- Absence management (planned and unexplained)
- Resource allocation and tutor assignments
- Trial session management and student onboarding
- Shift swaps and substitute management for tutors

### Communication
- Internal messaging system with templates
- SMS integration for student/parent communication
- Automated template-based messaging for common scenarios:
  - Class time notifications
  - Absence confirmations
  - Trial session confirmations/rescheduling
  - Class changes and cancellations
  - Tutor shift assignments
- Communication history tracking

### Administrative Workflows
- Trial session booking and confirmation
- Subsidy interview scheduling
- Student registration and class assignment
- Assignment/English drafting session scheduling
- Staff trial shift scheduling
- Absence logging and management
- Task management for admin staff

### Reporting & Analytics
- Student attendance tracking
- Session history reporting
- Staff performance monitoring
- Project management and task tracking

## Technical Stack
- **Frontend**: Next.js, React, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Authentication, Database)
- **State Management**: Zustand, React Query
- **Form Management**: React Hook Form, Zod
- **UI Components**: Radix UI, Lucide React icons
- **Testing**: Jest, Playwright for E2E testing
- **Communication**: SMS service integration

## Development Status
- Next.js project setup: Complete
- Supabase authentication setup: Complete
- Database schema: Partially implemented
- UI components: In progress
- Core functionality: Not started

## Project Priorities
1. Complete database schema design
2. Implement core entity management (students, staff, classes)
3. Build scheduling and session management
4. Develop communication features with message templates
5. Create administrative workflows
6. Add reporting and analytics 