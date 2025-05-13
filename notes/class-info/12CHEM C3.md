---
Day: 6.Saturday PM
Time: 2:45
Subject: SACE 12CHEM
---
Tutor:: [[1.3 Tutors/Huanzhen Lin.md|Huanzhen Lin]]


> [!Example] Students
> ```dataview
> LIST
> WHERE contains(file.outlinks, this.file.link)
> ```

> [!warning]- Add or remove students
> Only use these buttons when making a new class, or for scheduling at the start of the year. To change a student's class log a PERMANENT CLASS CHANGE
> ```button
> name Add a student to this class
> type command
> action Templater: Insert Templates/Templater scripts - other/Add_Student_to_Class.md
> ```
> ```button
> name Remove a student from this class
> type command
> action Templater: Insert Templates/Templater scripts - other/Remove_student_from_class.md
> ```