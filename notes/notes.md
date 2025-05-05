workflow to implement


subjects table -> tutors -> classes -> students

# Changes Made - Database Population

## Database Schema
The database uses a relational structure with the following main tables:
- students - for student information
- staff - for tutors and admin staff
- subjects - for subject information
- classes - for class information
- staff_subjects - junction table for staff-subject relationships
- students_subjects - junction table for student-subject relationships
- sessions - for tracking individual sessions
- topics/subtopics - for curriculum organization

## Tutor Information
Populated the staff table with tutor information from YAML files, including:
- Personal details (name, email, phone)
- Roles (TUTOR or ADMINSTAFF)
- Status (ACTIVE, INACTIVE, TRIAL)
- Office key and parking remote status
- Availability (weekdays and weekend slots)

## Subject Definitions
Created subjects using curriculum types:
- SACE (South Australian Certificate of Education)
- IB (International Baccalaureate)
- PRESACE (Pre-high school)
- PRIMARY (Elementary/primary school)
- MEDICINE (Medical preparation like UCAT)

## Subject-Tutor Associations
Created staff_subjects junction records to associate tutors with their teaching subjects.

## Key Implementations
- Added proper SQL migrations to handle missing curriculum types
- Fixed constraints and applied proper column naming
- Ensured consistent data formatting for phone numbers and emails
- Implemented proper subject categorization by discipline and level

## Challenges Addressed
- Corrected naming inconsistencies in tutor last names
- Resolved ambiguous column references in SQL functions
- Added missing MEDICINE enum values for curriculum and discipline
- Fixed data format issues with availability fields

The database now contains complete staff records with their subject associations, ready for class and student enrollment.