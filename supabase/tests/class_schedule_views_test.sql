BEGIN;

SELECT plan(5);

SELECT has_column('public', 'vstudent_classes', 'short_name', 'student Class lists receive the canonical Class label');
SELECT has_column('public', 'vstudent_class_detail', 'schedule_summary_long', 'student Class details receive the complete schedule summary');
SELECT has_column('public', 'vtutor_classes', 'schedule_weekdays', 'tutor Class lists receive every matching weekday');
SELECT has_column('public', 'vtutor_class_detail', 'long_name', 'tutor Class details retain the canonical long label');
SELECT has_column('public', 'vstudent_classes', 'schedule_rows', 'student timetables receive every concrete recurring row');

SELECT * FROM finish();

ROLLBACK;
