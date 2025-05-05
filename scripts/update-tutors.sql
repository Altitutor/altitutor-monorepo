-- SQL to update tutors with correct information from YAML files

-- Update tutor: Alessia D'Angelis
UPDATE staff SET
  last_name = 'D''Angelis',
  email = '',
  phone_number = '435019856',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = true,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Alessia' AND last_name LIKE 'D''Angelis%';

-- Update tutor: Alexander Wabnitz
UPDATE staff SET
  last_name = 'Wabnitz',
  email = '',
  phone_number = '416152132',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = true,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Alexander' AND last_name LIKE 'Wabnitz%';

-- Update tutor: Cindy Shi
UPDATE staff SET
  last_name = 'Shi',
  email = '',
  phone_number = '61411328198',
  role = 'TUTOR',
  status = 'INACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Cindy' AND last_name LIKE 'Shi%';

-- Update tutor: Dat Hong
UPDATE staff SET
  last_name = 'Hong',
  email = '',
  phone_number = '404672634',
  role = 'TUTOR',
  status = 'INACTIVE',
  notes = '',
  has_parking_remote = 'PHYSICAL',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Dat' AND last_name LIKE 'Hong%';

-- Update tutor: Easwar Allada
UPDATE staff SET
  last_name = 'Allada',
  email = '',
  phone_number = '[object Object]',
  role = 'ADMINSTAFF',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = true,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = true
WHERE first_name = 'Easwar' AND last_name LIKE 'Allada%';

-- Update tutor: Edward Nitschke
UPDATE staff SET
  last_name = 'Nitschke',
  email = '',
  phone_number = '',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = true,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Edward' AND last_name LIKE 'Nitschke%';

-- Update tutor: Elliot Koh
UPDATE staff SET
  last_name = 'Koh',
  email = '',
  phone_number = '61448618303',
  role = 'ADMINSTAFF',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = true,
  availability_sunday_pm = true
WHERE first_name = 'Elliot' AND last_name LIKE 'Koh%';

-- Update tutor: Huanzhen Lin
UPDATE staff SET
  last_name = 'Lin',
  email = '',
  phone_number = '401727519',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = true,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = true,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Huanzhen' AND last_name LIKE 'Lin%';

-- Update tutor: Jayden Tran
UPDATE staff SET
  last_name = 'Tran',
  email = '',
  phone_number = '491043222',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Jayden' AND last_name LIKE 'Tran%';

-- Update tutor: Joshua Gooi
UPDATE staff SET
  last_name = 'Gooi',
  email = '',
  phone_number = '61488228481',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = true,
  availability_sunday_pm = false
WHERE first_name = 'Joshua' AND last_name LIKE 'Gooi%';

-- Update tutor: Justin Le
UPDATE staff SET
  last_name = 'Le',
  email = '',
  phone_number = '61416682508',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'PHYSICAL',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = true,
  availability_sunday_pm = false
WHERE first_name = 'Justin' AND last_name LIKE 'Le%';

-- Update tutor: Kevin Ling
UPDATE staff SET
  last_name = 'Ling',
  email = '',
  phone_number = '407738360',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = true,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Kevin' AND last_name LIKE 'Ling%';

-- Update tutor: Kevin Zhou
UPDATE staff SET
  last_name = 'Zhou',
  email = '',
  phone_number = '61423250450',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'PHYSICAL',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = true,
  availability_sunday_pm = true
WHERE first_name = 'Kevin' AND last_name LIKE 'Zhou%';

-- Update tutor: Lara Nguyen
UPDATE staff SET
  last_name = 'Nguyen',
  email = '',
  phone_number = '61431318387',
  role = 'ADMINSTAFF',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = true,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Lara' AND last_name LIKE 'Nguyen%';

-- Update tutor: Livinia Xia-Bednikov
UPDATE staff SET
  last_name = 'Xia-Bednikov',
  email = '',
  phone_number = '459507530',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = true,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Livinia' AND last_name LIKE 'Xia-Bednikov%';

-- Update tutor: Lucy Fidock
UPDATE staff SET
  last_name = 'Fidock',
  email = '',
  phone_number = '406102975',
  role = 'TUTOR',
  status = 'INACTIVE',
  notes = '',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Lucy' AND last_name LIKE 'Fidock%';

-- Update tutor: Maddie Parker
UPDATE staff SET
  last_name = 'Parker',
  email = '',
  phone_number = '466659908',
  role = 'TUTOR',
  status = 'TRIAL',
  notes = 'Potential candidate – no shifts or subjects yet assigned.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Maddie' AND last_name LIKE 'Parker%';

-- Update tutor: Matthew Chua
UPDATE staff SET
  last_name = 'Chua',
  email = '',
  phone_number = '61478778288',
  role = 'ADMINSTAFF',
  status = 'ACTIVE',
  notes = 'Admin and tutor staff; teaches Year 12 Chemistry.',
  has_parking_remote = 'PHYSICAL',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Matthew' AND last_name LIKE 'Chua%';

-- Update tutor: Matthew Qin
UPDATE staff SET
  last_name = 'Qin',
  email = '',
  phone_number = '61426820721',
  role = 'ADMINSTAFF',
  status = 'ACTIVE',
  notes = 'Involved in multiple roles including admin, tutor, and resource; experienced across senior and bridging science/maths/English.',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = true,
  availability_wednesday = true,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = true,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Matthew' AND last_name LIKE 'Qin%';

-- Update tutor: Melshuel George
UPDATE staff SET
  last_name = 'George',
  email = '',
  phone_number = '416535231',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'Currently handling junior secondary English classes; schedule yet to be confirmed.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Melshuel' AND last_name LIKE 'George%';

-- Update tutor: Minah Cho
UPDATE staff SET
  last_name = 'Cho',
  email = '',
  phone_number = '+61 426 391 732',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'Assigned to UCAT A; available only Sunday mornings.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = true,
  availability_sunday_pm = false
WHERE first_name = 'Minah' AND last_name LIKE 'Cho%';

-- Update tutor: Rongjun He
UPDATE staff SET
  last_name = 'He',
  email = '',
  phone_number = '+61 424 885 318',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'Covers both SACE and IB curricula.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Rongjun' AND last_name LIKE 'He%';

-- Update tutor: Samantha Valerio
UPDATE staff SET
  last_name = 'Valerio',
  email = '',
  phone_number = '0433 422 125',
  role = 'ADMINSTAFF',
  status = 'ACTIVE',
  notes = 'Handles a wide range of English classes from Year 9 to Year 12 including Literature and AIF.',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = true,
  availability_tuesday = true,
  availability_wednesday = true,
  availability_thursday = true,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = true,
  availability_sunday_am = true,
  availability_sunday_pm = true
WHERE first_name = 'Samantha' AND last_name LIKE 'Valerio%';

-- Update tutor: Shardul Mulye
UPDATE staff SET
  last_name = 'Mulye',
  email = '',
  phone_number = '+61 410 390 279',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'Covers a broad range of STEM and medical prep subjects, including UCAT.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = true,
  availability_sunday_pm = true
WHERE first_name = 'Shardul' AND last_name LIKE 'Mulye%';

-- Update tutor: Shayne Turner
UPDATE staff SET
  last_name = 'Turner',
  email = '',
  phone_number = 'Not provided',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'Covers junior secondary Science and Maths.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Shayne' AND last_name LIKE 'Turner%';

-- Update tutor: Spencer Zhou
UPDATE staff SET
  last_name = 'Zhou',
  email = '',
  phone_number = '+61 410 422 276',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'Covers senior STEM subjects, including Specialist Maths and Physics.',
  has_parking_remote = 'PHYSICAL',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Spencer' AND last_name LIKE 'Zhou%';

-- Update tutor: Syme Aftab
UPDATE staff SET
  last_name = 'Aftab',
  email = '',
  phone_number = '+61 424 855 447',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'Focuses on Year 12 sciences and senior mathematics.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = true,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Syme' AND last_name LIKE 'Aftab%';

-- Update tutor: Tim Naylor
UPDATE staff SET
  last_name = 'Naylor',
  email = '',
  phone_number = '+61 498 097 227',
  role = 'TUTOR',
  status = 'ACTIVE',
  notes = 'IB Tutor and Resource support staff. Subjects focus on IB science and maths.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Tim' AND last_name LIKE 'Naylor%';

-- Update tutor: Tristan Theseira
UPDATE staff SET
  last_name = 'Theseira',
  email = '',
  phone_number = '+61 420 424 079',
  role = 'ADMINSTAFF',
  status = 'INACTIVE',
  notes = 'Previously held dual roles in tutoring and administration.',
  has_parking_remote = 'NONE',
  office_key_number = 1,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = false,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = false,
  availability_saturday_pm = false,
  availability_sunday_am = false,
  availability_sunday_pm = false
WHERE first_name = 'Tristan' AND last_name LIKE 'Theseira%';

-- Update tutor: Yuhan Wang
UPDATE staff SET
  last_name = 'Wang',
  email = '',
  phone_number = '+61 468 670 236',
  role = 'TUTOR',
  status = 'CURRENT',
  notes = 'Dual SACE and IB Tutor.',
  has_parking_remote = 'NONE',
  office_key_number = NULL,
  availability_monday = false,
  availability_tuesday = false,
  availability_wednesday = true,
  availability_thursday = false,
  availability_friday = false,
  availability_saturday_am = true,
  availability_saturday_pm = true,
  availability_sunday_am = false,
  availability_sunday_pm = true
WHERE first_name = 'Yuhan' AND last_name LIKE 'Wang%';

