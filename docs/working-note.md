cicd




its kinda slow - speed up load / db calls
- implement tanstack/react-query for api calls and caching. update components to use react-query
- optimise all api calls which traverse through tables to avoid n+1 problem - get everything in one fetch
- consistently use optimised queries in components, rather than calling multiple api methods sequentially 
- add composite indexes to supabase for join operations
- enable connection pooling
- implement prefetching
load classes with students, staff members, etc

dashboard

- buttons 
	- manual trial session booking - correlate availabilities with bookable sessions
- tasks 
	- students with subject but not in class 
	- students applying for subsidy but no subsidy interview scheduled 
	- meetings to confirm
- info
	- interactive daily timetable 
	    - sessions 
	        - planned absences 
	        - highlight sessions with no students 
- billing
	- invoices to follow up on
- messaging
	- unread / unreplied to messages



implementation
- [x] staff
    - [x] staff_subjects
- [x] students
    - [x] students_subjects
- [x] classes 
    - [x] classes_staff
        - [x] add to staff view modal - as a separate modal, and to table?
    - [x] classes_students
        - [x] add to students view modal - as a separate modal, and to table?
    - [x] calendar view 
- [ ] sessions
    - [ ] sessions_staff
        - [ ] add to staff view modal - as a separate modal 
    - [ ] sessions_students
        - [ ] add to students view modal - as a separate modal
    - [ ] reschedule session
- [ ] resource_files
    - [ ] sessions_resource_files
- [ ] absences
- [ ] build out dashboard 
- [ ] subjects - add staff view, classes view
- [ ] tasks - add tasks database
- [ ] messaging 
	- [ ] implement twilo
	- [ ] Bulk messaging
	- [ ] automate message sending
- [ ] calling?
- [ ] class planner 
- [ ] reports 
- [ ] notes
- [ ] booking system for english drafting and assignment drafting

workflows
- log planned absence (students can reschedule in their app)
- automate unplanned absences 
- new student registration (trial session + class assignments)
- add a subject / class to exisitng student
- permanent class change
- drafting booking
- subsidy interview
- tutoring interview
- shift swap
- staff trial shift

small tasks
- [ ] optimise for mobile 
- [ ] subjects - let search span across properties
- [ ] subtopics modal - change linked topic
- [ ] view staff modal overflowing email
- [ ] view staff modal availability styling
- [ ] sync staff account to user account


