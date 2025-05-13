-- SQL script to create classes and assign tutors

-- Class: 10ENG A4 (SACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'c5f6ed3b-20b9-4206-b05a-b0a291a0b752', 
  '10ENG A4', 
  map_day_to_number('6.Saturday PM'), 
  '14:15', 
  '15:15', 
  'ACTIVE',
  map_subject_to_id('10ENG A4')
);

-- Store mapping for tutor assignments
SELECT 'c5f6ed3b-20b9-4206-b05a-b0a291a0b752' as class_id, '10ENG A4' as class_code;

-- Assign tutor Samantha Valerio to class 10ENG A4
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  'c5f6ed3b-20b9-4206-b05a-b0a291a0b752',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'c5f6ed3b-20b9-4206-b05a-b0a291a0b752'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 10ENG A5 (PreSACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'de507a1c-a0d8-4a37-bab4-22efe2e47b2a', 
  '10ENG A5', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('10ENG A5')
);

-- Store mapping for tutor assignments
SELECT 'de507a1c-a0d8-4a37-bab4-22efe2e47b2a' as class_id, '10ENG A5' as class_code;

-- Assign tutor Samantha Valerio to class 10ENG A5
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  'de507a1c-a0d8-4a37-bab4-22efe2e47b2a',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'de507a1c-a0d8-4a37-bab4-22efe2e47b2a'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 10ENG A9 (PreSACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'd55dbd18-3b6a-438a-9572-8ed04ae23bcf', 
  '10ENG A9', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('10ENG A9')
);

-- Store mapping for tutor assignments
SELECT 'd55dbd18-3b6a-438a-9572-8ed04ae23bcf' as class_id, '10ENG A9' as class_code;

-- Assign tutor Melshuel George to class 10ENG A9
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Melshuel' AND last_name = 'George'),
  'd55dbd18-3b6a-438a-9572-8ed04ae23bcf',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Melshuel' AND last_name = 'George'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'd55dbd18-3b6a-438a-9572-8ed04ae23bcf'
WHERE 
  s.first_name = 'Melshuel' 
  AND s.last_name = 'George'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 10MATH A1 (PreSACE Maths)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '6dfad9ff-9589-4f55-9e20-3a194c57beba', 
  '10MATH A1', 
  map_day_to_number('3.Wednesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('10MATH A1')
);

-- Store mapping for tutor assignments
SELECT '6dfad9ff-9589-4f55-9e20-3a194c57beba' as class_id, '10MATH A1' as class_code;

-- Assign tutor Edward Nitschke to class 10MATH A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'),
  '6dfad9ff-9589-4f55-9e20-3a194c57beba',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '6dfad9ff-9589-4f55-9e20-3a194c57beba'
WHERE 
  s.first_name = 'Edward' 
  AND s.last_name = 'Nitschke'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 10MATH A4 (PreSACE Science)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '82f2e302-ac52-47b0-a76b-29e2a96312bd', 
  '10MATH A4', 
  map_day_to_number('6.Saturday AM'), 
  '09:30', 
  '10:30', 
  'ACTIVE',
  map_subject_to_id('10MATH A4')
);

-- Store mapping for tutor assignments
SELECT '82f2e302-ac52-47b0-a76b-29e2a96312bd' as class_id, '10MATH A4' as class_code;

-- Assign tutor Huanzhen Lin to class 10MATH A4
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'),
  '82f2e302-ac52-47b0-a76b-29e2a96312bd',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '82f2e302-ac52-47b0-a76b-29e2a96312bd'
WHERE 
  s.first_name = 'Huanzhen' 
  AND s.last_name = 'Lin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 10MATH C2 (PreSACE Maths)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '6683253c-052c-4511-9e4a-f647fe471b7d', 
  '10MATH C2', 
  map_day_to_number('6.Saturday PM'), 
  '14:45', 
  '15:45', 
  'ACTIVE',
  map_subject_to_id('10MATH C2')
);

-- Store mapping for tutor assignments
SELECT '6683253c-052c-4511-9e4a-f647fe471b7d' as class_id, '10MATH C2' as class_code;

-- Assign tutor Yuhan Wang to class 10MATH C2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'),
  '6683253c-052c-4511-9e4a-f647fe471b7d',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '6683253c-052c-4511-9e4a-f647fe471b7d'
WHERE 
  s.first_name = 'Yuhan' 
  AND s.last_name = 'Wang'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 10SCI B1 (PreSACE Science)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '37c433b6-be7d-438c-a603-9cd69f7e0722', 
  '10SCI B1', 
  map_day_to_number('6.Saturday PM'), 
  '13:15', 
  '14:15', 
  'ACTIVE',
  map_subject_to_id('10SCI B1')
);

-- Store mapping for tutor assignments
SELECT '37c433b6-be7d-438c-a603-9cd69f7e0722' as class_id, '10SCI B1' as class_code;

-- Assign tutor Huanzhen Lin to class 10SCI B1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'),
  '37c433b6-be7d-438c-a603-9cd69f7e0722',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '37c433b6-be7d-438c-a603-9cd69f7e0722'
WHERE 
  s.first_name = 'Huanzhen' 
  AND s.last_name = 'Lin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 10SCI B3 (PreSACE Maths)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '9e69741f-0ef2-4bd4-a0eb-c9d6cdecebc9', 
  '10SCI B3', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('10SCI B3')
);

-- Store mapping for tutor assignments
SELECT '9e69741f-0ef2-4bd4-a0eb-c9d6cdecebc9' as class_id, '10SCI B3' as class_code;

-- Assign tutor Huanzhen Lin to class 10SCI B3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'),
  '9e69741f-0ef2-4bd4-a0eb-c9d6cdecebc9',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '9e69741f-0ef2-4bd4-a0eb-c9d6cdecebc9'
WHERE 
  s.first_name = 'Huanzhen' 
  AND s.last_name = 'Lin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11AIF A1 (AIF)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '7dabe11a-3dc5-4188-87ba-7812b53c0585', 
  '11AIF A1', 
  map_day_to_number('7.Sunday PM'), 
  '14:45', 
  '15:45', 
  'ACTIVE',
  map_subject_to_id('11AIF A1')
);

-- Store mapping for tutor assignments
SELECT '7dabe11a-3dc5-4188-87ba-7812b53c0585' as class_id, '11AIF A1' as class_code;

-- Assign tutor Samantha Valerio to class 11AIF A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  '7dabe11a-3dc5-4188-87ba-7812b53c0585',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '7dabe11a-3dc5-4188-87ba-7812b53c0585'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11BIO A3 (SACE 11BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '5fa4f53b-da3b-48bb-8a2e-91964794f8a2', 
  '11BIO A3', 
  map_day_to_number('3.Wednesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('11BIO A3')
);

-- Store mapping for tutor assignments
SELECT '5fa4f53b-da3b-48bb-8a2e-91964794f8a2' as class_id, '11BIO A3' as class_code;

-- Assign tutor Yuhan Wang to class 11BIO A3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'),
  '5fa4f53b-da3b-48bb-8a2e-91964794f8a2',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '5fa4f53b-da3b-48bb-8a2e-91964794f8a2'
WHERE 
  s.first_name = 'Yuhan' 
  AND s.last_name = 'Wang'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11CHEM A1 (SACE 11CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '7ec17387-d1da-4a32-98d8-c954c1e182a2', 
  '11CHEM A1', 
  map_day_to_number('3.Wednesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('11CHEM A1')
);

-- Store mapping for tutor assignments
SELECT '7ec17387-d1da-4a32-98d8-c954c1e182a2' as class_id, '11CHEM A1' as class_code;

-- Assign tutor Matthew Qin to class 11CHEM A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'),
  '7ec17387-d1da-4a32-98d8-c954c1e182a2',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '7ec17387-d1da-4a32-98d8-c954c1e182a2'
WHERE 
  s.first_name = 'Matthew' 
  AND s.last_name = 'Qin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11CHEM D1 (SACE 11CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '8cb27491-f7f1-49de-b481-3f13daab162a', 
  '11CHEM D1', 
  map_day_to_number('4.Thursday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('11CHEM D1')
);

-- Store mapping for tutor assignments
SELECT '8cb27491-f7f1-49de-b481-3f13daab162a' as class_id, '11CHEM D1' as class_code;

-- Assign tutor Edward Nitschke to class 11CHEM D1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'),
  '8cb27491-f7f1-49de-b481-3f13daab162a',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '8cb27491-f7f1-49de-b481-3f13daab162a'
WHERE 
  s.first_name = 'Edward' 
  AND s.last_name = 'Nitschke'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11ENG A1 (SACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '8e790be7-82bc-41c9-bdeb-7192085888dd', 
  '11ENG A1', 
  map_day_to_number('3.Wednesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('11ENG A1')
);

-- Store mapping for tutor assignments
SELECT '8e790be7-82bc-41c9-bdeb-7192085888dd' as class_id, '11ENG A1' as class_code;

-- Assign tutor Samantha Valerio to class 11ENG A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  '8e790be7-82bc-41c9-bdeb-7192085888dd',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '8e790be7-82bc-41c9-bdeb-7192085888dd'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11ENG B2 (SACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '46b02ae2-5c0b-4fcc-a123-664ff2bf576f', 
  '11ENG B2', 
  map_day_to_number('6.Saturday PM'), 
  '12:30', 
  '13:30', 
  'ACTIVE',
  map_subject_to_id('11ENG B2')
);

-- Store mapping for tutor assignments
SELECT '46b02ae2-5c0b-4fcc-a123-664ff2bf576f' as class_id, '11ENG B2' as class_code;

-- Assign tutor Samantha Valerio to class 11ENG B2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  '46b02ae2-5c0b-4fcc-a123-664ff2bf576f',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '46b02ae2-5c0b-4fcc-a123-664ff2bf576f'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11IB BIO A4 (IB BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '1446da79-38c6-4af2-b7b4-d716fc28deeb', 
  '11IB BIO A4', 
  map_day_to_number('7.Sunday PM'), 
  '14:00', 
  '15:00', 
  'ACTIVE',
  map_subject_to_id('11IB BIO A4')
);

-- Store mapping for tutor assignments
SELECT '1446da79-38c6-4af2-b7b4-d716fc28deeb' as class_id, '11IB BIO A4' as class_code;

-- Assign tutor Yuhan Wang to class 11IB BIO A4
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'),
  '1446da79-38c6-4af2-b7b4-d716fc28deeb',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '1446da79-38c6-4af2-b7b4-d716fc28deeb'
WHERE 
  s.first_name = 'Yuhan' 
  AND s.last_name = 'Wang'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11IB ECO (IB ECO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '3b04b75a-1d7e-4849-9da6-d076e993ed28', 
  '11IB ECO', 
  map_day_to_number('2.Tuesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('11IB ECO')
);

-- Store mapping for tutor assignments
SELECT '3b04b75a-1d7e-4849-9da6-d076e993ed28' as class_id, '11IB ECO' as class_code;

-- Assign tutor Yuhan Wang to class 11IB ECO
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'),
  '3b04b75a-1d7e-4849-9da6-d076e993ed28',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '3b04b75a-1d7e-4849-9da6-d076e993ed28'
WHERE 
  s.first_name = 'Yuhan' 
  AND s.last_name = 'Wang'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11METH A1 (SACE 11METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'ec074c12-28e4-44a6-95c5-113b7f2dc3a2', 
  '11METH A1', 
  map_day_to_number('3.Wednesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('11METH A1')
);

-- Store mapping for tutor assignments
SELECT 'ec074c12-28e4-44a6-95c5-113b7f2dc3a2' as class_id, '11METH A1' as class_code;

-- Assign tutor Alexander Wabnitz to class 11METH A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'),
  'ec074c12-28e4-44a6-95c5-113b7f2dc3a2',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'ec074c12-28e4-44a6-95c5-113b7f2dc3a2'
WHERE 
  s.first_name = 'Alexander' 
  AND s.last_name = 'Wabnitz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11METH A2 (SACE 11METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'c5ff2adc-d3be-41b1-845c-4a48cd897eba', 
  '11METH A2', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('11METH A2')
);

-- Store mapping for tutor assignments
SELECT 'c5ff2adc-d3be-41b1-845c-4a48cd897eba' as class_id, '11METH A2' as class_code;

-- Assign tutor Alessia D'Angelis to class 11METH A2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'),
  'c5ff2adc-d3be-41b1-845c-4a48cd897eba',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'c5ff2adc-d3be-41b1-845c-4a48cd897eba'
WHERE 
  s.first_name = 'Alessia' 
  AND s.last_name = 'D'Angelo'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11METH D1 (SACE 11METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '4b83c467-677f-42f4-a2fb-6acd808d1131', 
  '11METH D1', 
  map_day_to_number('4.Thursday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('11METH D1')
);

-- Store mapping for tutor assignments
SELECT '4b83c467-677f-42f4-a2fb-6acd808d1131' as class_id, '11METH D1' as class_code;

-- Assign tutor Edward Nitschke to class 11METH D1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'),
  '4b83c467-677f-42f4-a2fb-6acd808d1131',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '4b83c467-677f-42f4-a2fb-6acd808d1131'
WHERE 
  s.first_name = 'Edward' 
  AND s.last_name = 'Nitschke'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11PHYS A3 (SACE 11PHYS)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '4021276e-d0b5-4534-a334-e2b434906c4b', 
  '11PHYS A3', 
  map_day_to_number('2.Tuesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('11PHYS A3')
);

-- Store mapping for tutor assignments
SELECT '4021276e-d0b5-4534-a334-e2b434906c4b' as class_id, '11PHYS A3' as class_code;

-- Assign tutor Alessia D'Angelis to class 11PHYS A3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'),
  '4021276e-d0b5-4534-a334-e2b434906c4b',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '4021276e-d0b5-4534-a334-e2b434906c4b'
WHERE 
  s.first_name = 'Alessia' 
  AND s.last_name = 'D'Angelo'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 11SPEC A2 (SACE 11SPEC)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '25a6fe18-7253-4ebd-8cc0-f891019eb870', 
  '11SPEC A2', 
  map_day_to_number('2.Tuesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('11SPEC A2')
);

-- Store mapping for tutor assignments
SELECT '25a6fe18-7253-4ebd-8cc0-f891019eb870' as class_id, '11SPEC A2' as class_code;

-- Assign tutor Alessia D'Angelis to class 11SPEC A2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'),
  '25a6fe18-7253-4ebd-8cc0-f891019eb870',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '25a6fe18-7253-4ebd-8cc0-f891019eb870'
WHERE 
  s.first_name = 'Alessia' 
  AND s.last_name = 'D'Angelo'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12 IB MATH AA SL (IB 12MATH AA SL)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '9191f7a9-86d9-466d-adb5-4f2c040fe9e8', 
  '12 IB MATH AA SL', 
  map_day_to_number('7.Sunday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('12 IB MATH AA SL')
);

-- Store mapping for tutor assignments
SELECT '9191f7a9-86d9-466d-adb5-4f2c040fe9e8' as class_id, '12 IB MATH AA SL' as class_code;

-- Assign tutor Kevin Zhou to class 12 IB MATH AA SL
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Kevin' AND last_name = 'Zhou'),
  '9191f7a9-86d9-466d-adb5-4f2c040fe9e8',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Kevin' AND last_name = 'Zhou'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '9191f7a9-86d9-466d-adb5-4f2c040fe9e8'
WHERE 
  s.first_name = 'Kevin' 
  AND s.last_name = 'Zhou'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12BIO A1 (SACE 12BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'fea1b6a0-832e-46fc-a7ff-1747ab840c53', 
  '12BIO A1', 
  map_day_to_number('3.Wednesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('12BIO A1')
);

-- Store mapping for tutor assignments
SELECT 'fea1b6a0-832e-46fc-a7ff-1747ab840c53' as class_id, '12BIO A1' as class_code;

-- Assign tutor Yuhan Wang to class 12BIO A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'),
  'fea1b6a0-832e-46fc-a7ff-1747ab840c53',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'fea1b6a0-832e-46fc-a7ff-1747ab840c53'
WHERE 
  s.first_name = 'Yuhan' 
  AND s.last_name = 'Wang'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12BIO A4 (SACE 12BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'dd863066-e832-4044-88a7-df498c145266', 
  '12BIO A4', 
  map_day_to_number('6.Saturday PM'), 
  '13:15', 
  '14:15', 
  'ACTIVE',
  map_subject_to_id('12BIO A4')
);

-- Store mapping for tutor assignments
SELECT 'dd863066-e832-4044-88a7-df498c145266' as class_id, '12BIO A4' as class_code;

-- Assign tutor Kevin Ling to class 12BIO A4
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Kevin' AND last_name = 'Ling'),
  'dd863066-e832-4044-88a7-df498c145266',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Kevin' AND last_name = 'Ling'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'dd863066-e832-4044-88a7-df498c145266'
WHERE 
  s.first_name = 'Kevin' 
  AND s.last_name = 'Ling'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12BIO B2 (SACE 12BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '0202a30b-8b2e-4f32-b2ee-878a0dc512f4', 
  '12BIO B2', 
  map_day_to_number('6.Saturday PM'), 
  '14:45', 
  '15:45', 
  'ACTIVE',
  map_subject_to_id('12BIO B2')
);

-- Store mapping for tutor assignments
SELECT '0202a30b-8b2e-4f32-b2ee-878a0dc512f4' as class_id, '12BIO B2' as class_code;

-- Assign tutor Kevin Ling to class 12BIO B2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Kevin' AND last_name = 'Ling'),
  '0202a30b-8b2e-4f32-b2ee-878a0dc512f4',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Kevin' AND last_name = 'Ling'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '0202a30b-8b2e-4f32-b2ee-878a0dc512f4'
WHERE 
  s.first_name = 'Kevin' 
  AND s.last_name = 'Ling'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12BIO C3 (SACE 12BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'f3d2c381-d16a-4418-9156-6d3200323d38', 
  '12BIO C3', 
  map_day_to_number('2.Tuesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12BIO C3')
);

-- Store mapping for tutor assignments
SELECT 'f3d2c381-d16a-4418-9156-6d3200323d38' as class_id, '12BIO C3' as class_code;

-- Assign tutor Matthew Qin to class 12BIO C3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'),
  'f3d2c381-d16a-4418-9156-6d3200323d38',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'f3d2c381-d16a-4418-9156-6d3200323d38'
WHERE 
  s.first_name = 'Matthew' 
  AND s.last_name = 'Qin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12CHEM A1 (SACE 12CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '33f5e87e-67ff-43ad-bfe8-85842a700ebe', 
  '12CHEM A1', 
  map_day_to_number('3.Wednesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('12CHEM A1')
);

-- Store mapping for tutor assignments
SELECT '33f5e87e-67ff-43ad-bfe8-85842a700ebe' as class_id, '12CHEM A1' as class_code;

-- Assign tutor Edward Nitschke to class 12CHEM A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'),
  '33f5e87e-67ff-43ad-bfe8-85842a700ebe',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '33f5e87e-67ff-43ad-bfe8-85842a700ebe'
WHERE 
  s.first_name = 'Edward' 
  AND s.last_name = 'Nitschke'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Assign tutor Matthew Chua to class 12CHEM A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Matthew' AND last_name = 'Chua'),
  '33f5e87e-67ff-43ad-bfe8-85842a700ebe',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Matthew' AND last_name = 'Chua'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '33f5e87e-67ff-43ad-bfe8-85842a700ebe'
WHERE 
  s.first_name = 'Matthew' 
  AND s.last_name = 'Chua'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12CHEM A2 (SACE 12CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '95b1be91-a0ec-4201-89a0-a94d617df4bc', 
  '12CHEM A2', 
  map_day_to_number('4.Thursday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('12CHEM A2')
);

-- Store mapping for tutor assignments
SELECT '95b1be91-a0ec-4201-89a0-a94d617df4bc' as class_id, '12CHEM A2' as class_code;

-- Assign tutor Matthew Qin to class 12CHEM A2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'),
  '95b1be91-a0ec-4201-89a0-a94d617df4bc',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '95b1be91-a0ec-4201-89a0-a94d617df4bc'
WHERE 
  s.first_name = 'Matthew' 
  AND s.last_name = 'Qin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12CHEM B2 (SACE 12CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '9afa4340-bf2f-4e3b-a66d-c513561aeff4', 
  '12CHEM B2', 
  map_day_to_number('6.Saturday AM'), 
  '09:30', 
  '10:30', 
  'ACTIVE',
  map_subject_to_id('12CHEM B2')
);

-- Store mapping for tutor assignments
SELECT '9afa4340-bf2f-4e3b-a66d-c513561aeff4' as class_id, '12CHEM B2' as class_code;

-- Assign tutor Syme Aftab to class 12CHEM B2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Syme' AND last_name = 'Aftab'),
  '9afa4340-bf2f-4e3b-a66d-c513561aeff4',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Syme' AND last_name = 'Aftab'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '9afa4340-bf2f-4e3b-a66d-c513561aeff4'
WHERE 
  s.first_name = 'Syme' 
  AND s.last_name = 'Aftab'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Assign tutor Alessia D'Angelis to class 12CHEM B2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'),
  '9afa4340-bf2f-4e3b-a66d-c513561aeff4',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alessia' AND last_name = 'D'Angelo'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '9afa4340-bf2f-4e3b-a66d-c513561aeff4'
WHERE 
  s.first_name = 'Alessia' 
  AND s.last_name = 'D'Angelo'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12CHEM C3 (SACE 12CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '653f71ce-ec78-4c82-9713-7aa111ebe845', 
  '12CHEM C3', 
  map_day_to_number('6.Saturday PM'), 
  '14:45', 
  '15:45', 
  'ACTIVE',
  map_subject_to_id('12CHEM C3')
);

-- Store mapping for tutor assignments
SELECT '653f71ce-ec78-4c82-9713-7aa111ebe845' as class_id, '12CHEM C3' as class_code;

-- Assign tutor Huanzhen Lin to class 12CHEM C3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'),
  '653f71ce-ec78-4c82-9713-7aa111ebe845',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '653f71ce-ec78-4c82-9713-7aa111ebe845'
WHERE 
  s.first_name = 'Huanzhen' 
  AND s.last_name = 'Lin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12CHEM C4 (SACE 12CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '7c9776e8-c382-49ea-a6f5-e9410ff9c920', 
  '12CHEM C4', 
  map_day_to_number('2.Tuesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('12CHEM C4')
);

-- Store mapping for tutor assignments
SELECT '7c9776e8-c382-49ea-a6f5-e9410ff9c920' as class_id, '12CHEM C4' as class_code;

-- Assign tutor Huanzhen Lin to class 12CHEM C4
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'),
  '7c9776e8-c382-49ea-a6f5-e9410ff9c920',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '7c9776e8-c382-49ea-a6f5-e9410ff9c920'
WHERE 
  s.first_name = 'Huanzhen' 
  AND s.last_name = 'Lin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12ENG A5 (SACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '93f9daaa-83b2-45d8-ab9f-1ba2a478201a', 
  '12ENG A5', 
  map_day_to_number('2.Tuesday'), 
  '13:30', 
  '14:30', 
  'ACTIVE',
  map_subject_to_id('12ENG A5')
);

-- Store mapping for tutor assignments
SELECT '93f9daaa-83b2-45d8-ab9f-1ba2a478201a' as class_id, '12ENG A5' as class_code;

-- Assign tutor Samantha Valerio to class 12ENG A5
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  '93f9daaa-83b2-45d8-ab9f-1ba2a478201a',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '93f9daaa-83b2-45d8-ab9f-1ba2a478201a'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12ENG A6 (SACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'e4517c2d-3bc2-4130-8794-ac26b1bd376e', 
  '12ENG A6', 
  map_day_to_number('2.Tuesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12ENG A6')
);

-- Store mapping for tutor assignments
SELECT 'e4517c2d-3bc2-4130-8794-ac26b1bd376e' as class_id, '12ENG A6' as class_code;

-- Assign tutor Samantha Valerio to class 12ENG A6
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  'e4517c2d-3bc2-4130-8794-ac26b1bd376e',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'e4517c2d-3bc2-4130-8794-ac26b1bd376e'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12ENG LIT A1 (SACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '4a8578bb-36bf-406c-b13d-6ee43fa320b2', 
  '12ENG LIT A1', 
  map_day_to_number('3.Wednesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12ENG LIT A1')
);

-- Store mapping for tutor assignments
SELECT '4a8578bb-36bf-406c-b13d-6ee43fa320b2' as class_id, '12ENG LIT A1' as class_code;

-- Assign tutor Samantha Valerio to class 12ENG LIT A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  '4a8578bb-36bf-406c-b13d-6ee43fa320b2',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '4a8578bb-36bf-406c-b13d-6ee43fa320b2'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12IB CHEM A1 (IB CHEM)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '61b661a1-28f1-4305-9300-6cbca6e8ba07', 
  '12IB CHEM A1', 
  map_day_to_number('6.Saturday PM'), 
  '13:15', 
  '14:15', 
  'ACTIVE',
  map_subject_to_id('12IB CHEM A1')
);

-- Store mapping for tutor assignments
SELECT '61b661a1-28f1-4305-9300-6cbca6e8ba07' as class_id, '12IB CHEM A1' as class_code;

-- Assign tutor Livinia Xia-Bednikov to class 12IB CHEM A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'),
  '61b661a1-28f1-4305-9300-6cbca6e8ba07',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '61b661a1-28f1-4305-9300-6cbca6e8ba07'
WHERE 
  s.first_name = 'Livinia' 
  AND s.last_name = 'Xia-Bednorz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12IB PHYS A1 (IBPHYS)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'e5bfac81-5389-4ca2-970c-caf9e3d0e57a', 
  '12IB PHYS A1', 
  map_day_to_number('6.Saturday PM'), 
  '14:45', 
  '15:45', 
  'ACTIVE',
  map_subject_to_id('12IB PHYS A1')
);

-- Store mapping for tutor assignments
SELECT 'e5bfac81-5389-4ca2-970c-caf9e3d0e57a' as class_id, '12IB PHYS A1' as class_code;

-- Assign tutor Livinia Xia-Bednikov to class 12IB PHYS A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'),
  'e5bfac81-5389-4ca2-970c-caf9e3d0e57a',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'e5bfac81-5389-4ca2-970c-caf9e3d0e57a'
WHERE 
  s.first_name = 'Livinia' 
  AND s.last_name = 'Xia-Bednorz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12IBBIO A1 (IB BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '3c124cbe-68a5-4134-8541-9e991dd5b297', 
  '12IBBIO A1', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('12IBBIO A1')
);

-- Store mapping for tutor assignments
SELECT '3c124cbe-68a5-4134-8541-9e991dd5b297' as class_id, '12IBBIO A1' as class_code;

-- Assign tutor Yuhan Wang to class 12IBBIO A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'),
  '3c124cbe-68a5-4134-8541-9e991dd5b297',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '3c124cbe-68a5-4134-8541-9e991dd5b297'
WHERE 
  s.first_name = 'Yuhan' 
  AND s.last_name = 'Wang'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12METH A1 (SACE 12METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'd05d189a-cecb-47fb-b41f-cee9de4cb4a7', 
  '12METH A1', 
  map_day_to_number('3.Wednesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12METH A1')
);

-- Store mapping for tutor assignments
SELECT 'd05d189a-cecb-47fb-b41f-cee9de4cb4a7' as class_id, '12METH A1' as class_code;

-- Assign tutor Alexander Wabnitz to class 12METH A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'),
  'd05d189a-cecb-47fb-b41f-cee9de4cb4a7',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'd05d189a-cecb-47fb-b41f-cee9de4cb4a7'
WHERE 
  s.first_name = 'Alexander' 
  AND s.last_name = 'Wabnitz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Assign tutor Edward Nitschke to class 12METH A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'),
  'd05d189a-cecb-47fb-b41f-cee9de4cb4a7',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Edward' AND last_name = 'Nitschke'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'd05d189a-cecb-47fb-b41f-cee9de4cb4a7'
WHERE 
  s.first_name = 'Edward' 
  AND s.last_name = 'Nitschke'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12METH A2 (SACE 12METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '0a95907f-ee84-48f7-a75c-ca47ae40fb66', 
  '12METH A2', 
  map_day_to_number('3.Wednesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12METH A2')
);

-- Store mapping for tutor assignments
SELECT '0a95907f-ee84-48f7-a75c-ca47ae40fb66' as class_id, '12METH A2' as class_code;

-- Assign tutor Matthew Qin to class 12METH A2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'),
  '0a95907f-ee84-48f7-a75c-ca47ae40fb66',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '0a95907f-ee84-48f7-a75c-ca47ae40fb66'
WHERE 
  s.first_name = 'Matthew' 
  AND s.last_name = 'Qin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12METH B2 (SACE 12METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'e38197f9-3857-412c-8d03-b493000f4aae', 
  '12METH B2', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('12METH B2')
);

-- Store mapping for tutor assignments
SELECT 'e38197f9-3857-412c-8d03-b493000f4aae' as class_id, '12METH B2' as class_code;

-- Assign tutor Syme Aftab to class 12METH B2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Syme' AND last_name = 'Aftab'),
  'e38197f9-3857-412c-8d03-b493000f4aae',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Syme' AND last_name = 'Aftab'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'e38197f9-3857-412c-8d03-b493000f4aae'
WHERE 
  s.first_name = 'Syme' 
  AND s.last_name = 'Aftab'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12METH C3 (SACE 12METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '3867d5d8-cfcd-45c5-9ecf-35dc30eda7ff', 
  '12METH C3', 
  map_day_to_number('6.Saturday PM'), 
  '13:15', 
  '14:15', 
  'ACTIVE',
  map_subject_to_id('12METH C3')
);

-- Store mapping for tutor assignments
SELECT '3867d5d8-cfcd-45c5-9ecf-35dc30eda7ff' as class_id, '12METH C3' as class_code;

-- Assign tutor Yuhan Wang to class 12METH C3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'),
  '3867d5d8-cfcd-45c5-9ecf-35dc30eda7ff',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Yuhan' AND last_name = 'Wang'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '3867d5d8-cfcd-45c5-9ecf-35dc30eda7ff'
WHERE 
  s.first_name = 'Yuhan' 
  AND s.last_name = 'Wang'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Assign tutor Jayden Tran to class 12METH C3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Jayden' AND last_name = 'Tran'),
  '3867d5d8-cfcd-45c5-9ecf-35dc30eda7ff',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Jayden' AND last_name = 'Tran'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '3867d5d8-cfcd-45c5-9ecf-35dc30eda7ff'
WHERE 
  s.first_name = 'Jayden' 
  AND s.last_name = 'Tran'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12METH C5 (SACE 12METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'd43669bd-4e42-4bb4-a281-f1dc7fc4e737', 
  '12METH C5', 
  map_day_to_number('2.Tuesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12METH C5')
);

-- Store mapping for tutor assignments
SELECT 'd43669bd-4e42-4bb4-a281-f1dc7fc4e737' as class_id, '12METH C5' as class_code;

-- Assign tutor Huanzhen Lin to class 12METH C5
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'),
  'd43669bd-4e42-4bb4-a281-f1dc7fc4e737',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Huanzhen' AND last_name = 'Lin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'd43669bd-4e42-4bb4-a281-f1dc7fc4e737'
WHERE 
  s.first_name = 'Huanzhen' 
  AND s.last_name = 'Lin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12METH C6 (SACE 12METH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'c1f25350-9727-49fe-a7e5-d8b9050076fd', 
  '12METH C6', 
  map_day_to_number('4.Thursday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12METH C6')
);

-- Store mapping for tutor assignments
SELECT 'c1f25350-9727-49fe-a7e5-d8b9050076fd' as class_id, '12METH C6' as class_code;

-- Assign tutor Matthew Qin to class 12METH C6
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'),
  'c1f25350-9727-49fe-a7e5-d8b9050076fd',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Matthew' AND last_name = 'Qin'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'c1f25350-9727-49fe-a7e5-d8b9050076fd'
WHERE 
  s.first_name = 'Matthew' 
  AND s.last_name = 'Qin'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12PHYS A1-1 (SACE 12PHYS)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '0911ee5d-2e40-4fe1-830f-8e9c8fefd4b4', 
  '12PHYS A1-1', 
  map_day_to_number('2.Tuesday'), 
  '17:45', 
  '18:45', 
  'ACTIVE',
  map_subject_to_id('12PHYS A1-1')
);

-- Store mapping for tutor assignments
SELECT '0911ee5d-2e40-4fe1-830f-8e9c8fefd4b4' as class_id, '12PHYS A1-1' as class_code;

-- Assign tutor Alexander Wabnitz to class 12PHYS A1-1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'),
  '0911ee5d-2e40-4fe1-830f-8e9c8fefd4b4',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '0911ee5d-2e40-4fe1-830f-8e9c8fefd4b4'
WHERE 
  s.first_name = 'Alexander' 
  AND s.last_name = 'Wabnitz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12PHYS B2 (SACE 12PHYS)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '64274835-265c-46aa-aa71-3dfe949402bf', 
  '12PHYS B2', 
  map_day_to_number('6.Saturday AM'), 
  '09:30', 
  '10:30', 
  'ACTIVE',
  map_subject_to_id('12PHYS B2')
);

-- Store mapping for tutor assignments
SELECT '64274835-265c-46aa-aa71-3dfe949402bf' as class_id, '12PHYS B2' as class_code;

-- Assign tutor Rongjun He to class 12PHYS B2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Rongjun' AND last_name = 'He'),
  '64274835-265c-46aa-aa71-3dfe949402bf',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Rongjun' AND last_name = 'He'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '64274835-265c-46aa-aa71-3dfe949402bf'
WHERE 
  s.first_name = 'Rongjun' 
  AND s.last_name = 'He'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12SPEC A1 (SACE 12SPEC)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '4a35b9f4-999e-4acf-9eb7-0ccf21efda1c', 
  '12SPEC A1', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('12SPEC A1')
);

-- Store mapping for tutor assignments
SELECT '4a35b9f4-999e-4acf-9eb7-0ccf21efda1c' as class_id, '12SPEC A1' as class_code;

-- Assign tutor Rongjun He to class 12SPEC A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Rongjun' AND last_name = 'He'),
  '4a35b9f4-999e-4acf-9eb7-0ccf21efda1c',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Rongjun' AND last_name = 'He'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '4a35b9f4-999e-4acf-9eb7-0ccf21efda1c'
WHERE 
  s.first_name = 'Rongjun' 
  AND s.last_name = 'He'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 12SPEC A2 (SACE 12SPEC)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '4c7d1a27-79cb-4fa1-b236-c635b83340dc', 
  '12SPEC A2', 
  map_day_to_number('2.Tuesday'), 
  '16:15', 
  '17:15', 
  'ACTIVE',
  map_subject_to_id('12SPEC A2')
);

-- Store mapping for tutor assignments
SELECT '4c7d1a27-79cb-4fa1-b236-c635b83340dc' as class_id, '12SPEC A2' as class_code;

-- Assign tutor Alexander Wabnitz to class 12SPEC A2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'),
  '4c7d1a27-79cb-4fa1-b236-c635b83340dc',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Alexander' AND last_name = 'Wabnitz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '4c7d1a27-79cb-4fa1-b236-c635b83340dc'
WHERE 
  s.first_name = 'Alexander' 
  AND s.last_name = 'Wabnitz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 8ENG A3 (PreENG)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '9cf67dfd-f4ee-4292-8b9d-725c86ec957c', 
  '8ENG A3', 
  map_day_to_number('7.Sunday PM'), 
  '13:15', 
  '14:15', 
  'ACTIVE',
  map_subject_to_id('8ENG A3')
);

-- Store mapping for tutor assignments
SELECT '9cf67dfd-f4ee-4292-8b9d-725c86ec957c' as class_id, '8ENG A3' as class_code;

-- Assign tutor Melshuel George to class 8ENG A3
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Melshuel' AND last_name = 'George'),
  '9cf67dfd-f4ee-4292-8b9d-725c86ec957c',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Melshuel' AND last_name = 'George'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '9cf67dfd-f4ee-4292-8b9d-725c86ec957c'
WHERE 
  s.first_name = 'Melshuel' 
  AND s.last_name = 'George'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 8MATH C4 (PreMATH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '72aedd14-e2be-4592-bc9d-abb9231c39eb', 
  '8MATH C4', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('8MATH C4')
);

-- Store mapping for tutor assignments
SELECT '72aedd14-e2be-4592-bc9d-abb9231c39eb' as class_id, '8MATH C4' as class_code;

-- Assign tutor Jayden Tran to class 8MATH C4
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Jayden' AND last_name = 'Tran'),
  '72aedd14-e2be-4592-bc9d-abb9231c39eb',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Jayden' AND last_name = 'Tran'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '72aedd14-e2be-4592-bc9d-abb9231c39eb'
WHERE 
  s.first_name = 'Jayden' 
  AND s.last_name = 'Tran'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 8MATH D1 (PreSACE Maths)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '4e0f8841-4efa-49cc-bec6-2e694cf2ba15', 
  '8MATH D1', 
  map_day_to_number('6.Saturday PM'), 
  '13:15', 
  '14:15', 
  'ACTIVE',
  map_subject_to_id('8MATH D1')
);

-- Store mapping for tutor assignments
SELECT '4e0f8841-4efa-49cc-bec6-2e694cf2ba15' as class_id, '8MATH D1' as class_code;

-- Assign tutor Shayne Turner to class 8MATH D1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Shayne' AND last_name = 'Turner'),
  '4e0f8841-4efa-49cc-bec6-2e694cf2ba15',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Shayne' AND last_name = 'Turner'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '4e0f8841-4efa-49cc-bec6-2e694cf2ba15'
WHERE 
  s.first_name = 'Shayne' 
  AND s.last_name = 'Turner'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 8SCI A2 (PreSACE Science)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '3ce7f4e8-26a4-4cc2-b0ee-60565dced579', 
  '8SCI A2', 
  map_day_to_number('6.Saturday PM'), 
  '14:45', 
  '15:45', 
  'ACTIVE',
  map_subject_to_id('8SCI A2')
);

-- Store mapping for tutor assignments
SELECT '3ce7f4e8-26a4-4cc2-b0ee-60565dced579' as class_id, '8SCI A2' as class_code;

-- Assign tutor Shayne Turner to class 8SCI A2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Shayne' AND last_name = 'Turner'),
  '3ce7f4e8-26a4-4cc2-b0ee-60565dced579',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Shayne' AND last_name = 'Turner'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '3ce7f4e8-26a4-4cc2-b0ee-60565dced579'
WHERE 
  s.first_name = 'Shayne' 
  AND s.last_name = 'Turner'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: 9ENG A1 (PreSACE English)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '04ddfa93-ebdf-4d75-be7d-dd5944a407e5', 
  '9ENG A1', 
  map_day_to_number('6.Saturday AM'), 
  '09:30', 
  '10:30', 
  'ACTIVE',
  map_subject_to_id('9ENG A1')
);

-- Store mapping for tutor assignments
SELECT '04ddfa93-ebdf-4d75-be7d-dd5944a407e5' as class_id, '9ENG A1' as class_code;

-- Assign tutor Samantha Valerio to class 9ENG A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'),
  '04ddfa93-ebdf-4d75-be7d-dd5944a407e5',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Samantha' AND last_name = 'Valerio'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '04ddfa93-ebdf-4d75-be7d-dd5944a407e5'
WHERE 
  s.first_name = 'Samantha' 
  AND s.last_name = 'Valerio'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: IB BIO B1 (IB BIO)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '47f0aa01-e661-4df9-84b9-ba24f2737e37', 
  'IB BIO B1', 
  map_day_to_number('7.Sunday PM'), 
  '13:15', 
  '14:15', 
  'ACTIVE',
  map_subject_to_id('IB BIO B1')
);

-- Store mapping for tutor assignments
SELECT '47f0aa01-e661-4df9-84b9-ba24f2737e37' as class_id, 'IB BIO B1' as class_code;

-- Assign tutor Kevin Zhou to class IB BIO B1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Kevin' AND last_name = 'Zhou'),
  '47f0aa01-e661-4df9-84b9-ba24f2737e37',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Kevin' AND last_name = 'Zhou'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '47f0aa01-e661-4df9-84b9-ba24f2737e37'
WHERE 
  s.first_name = 'Kevin' 
  AND s.last_name = 'Zhou'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: IB MATH HL A2 (IB MATH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '01fe89cf-8c89-4f5b-a06a-3328630c7bda', 
  'IB MATH HL A2', 
  map_day_to_number('7.Sunday PM'), 
  '14:45', 
  '15:45', 
  'ACTIVE',
  map_subject_to_id('IB MATH HL A2')
);

-- Store mapping for tutor assignments
SELECT '01fe89cf-8c89-4f5b-a06a-3328630c7bda' as class_id, 'IB MATH HL A2' as class_code;

-- Assign tutor Kevin Zhou to class IB MATH HL A2
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Kevin' AND last_name = 'Zhou'),
  '01fe89cf-8c89-4f5b-a06a-3328630c7bda',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Kevin' AND last_name = 'Zhou'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '01fe89cf-8c89-4f5b-a06a-3328630c7bda'
WHERE 
  s.first_name = 'Kevin' 
  AND s.last_name = 'Zhou'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: IB PSYC A9 (IB SUBJECTS)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  'ea577b6c-84dc-4b17-a84e-4bfa10ad180e', 
  'IB PSYC A9', 
  map_day_to_number('6.Saturday AM'), 
  '09:30', 
  '10:30', 
  'ACTIVE',
  map_subject_to_id('IB PSYC A9')
);

-- Store mapping for tutor assignments
SELECT 'ea577b6c-84dc-4b17-a84e-4bfa10ad180e' as class_id, 'IB PSYC A9' as class_code;

-- Assign tutor Livinia Xia-Bednikov to class IB PSYC A9
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'),
  'ea577b6c-84dc-4b17-a84e-4bfa10ad180e',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = 'ea577b6c-84dc-4b17-a84e-4bfa10ad180e'
WHERE 
  s.first_name = 'Livinia' 
  AND s.last_name = 'Xia-Bednorz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: IBMATH AI A1 (IB MATH)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '1c0e4f1a-5d0d-4998-a68e-6fe2f1fc0674', 
  'IBMATH AI A1', 
  map_day_to_number('6.Saturday AM'), 
  '11:00', 
  '12:00', 
  'ACTIVE',
  map_subject_to_id('IBMATH AI A1')
);

-- Store mapping for tutor assignments
SELECT '1c0e4f1a-5d0d-4998-a68e-6fe2f1fc0674' as class_id, 'IBMATH AI A1' as class_code;

-- Assign tutor Livinia Xia-Bednikov to class IBMATH AI A1
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'),
  '1c0e4f1a-5d0d-4998-a68e-6fe2f1fc0674',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Livinia' AND last_name = 'Xia-Bednorz'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '1c0e4f1a-5d0d-4998-a68e-6fe2f1fc0674'
WHERE 
  s.first_name = 'Livinia' 
  AND s.last_name = 'Xia-Bednorz'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Class: UCAT A (UCAT)
INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '525677a9-1d76-40ea-9042-8add8743b910', 
  'UCAT A', 
  map_day_to_number('7.Sunday AM'), 
  '09:30', 
  '10:30', 
  'ACTIVE',
  map_subject_to_id('UCAT A')
);

-- Store mapping for tutor assignments
SELECT '525677a9-1d76-40ea-9042-8add8743b910' as class_id, 'UCAT A' as class_code;

-- Assign tutor Shardul Mulye to class UCAT A
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Shardul' AND last_name = 'Mulye'),
  '525677a9-1d76-40ea-9042-8add8743b910',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Shardul' AND last_name = 'Mulye'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '525677a9-1d76-40ea-9042-8add8743b910'
WHERE 
  s.first_name = 'Shardul' 
  AND s.last_name = 'Mulye'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Assign tutor Joshua Gooi to class UCAT A
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Joshua' AND last_name = 'Gooi'),
  '525677a9-1d76-40ea-9042-8add8743b910',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Joshua' AND last_name = 'Gooi'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '525677a9-1d76-40ea-9042-8add8743b910'
WHERE 
  s.first_name = 'Joshua' 
  AND s.last_name = 'Gooi'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Assign tutor Justin Le to class UCAT A
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Justin' AND last_name = 'Le'),
  '525677a9-1d76-40ea-9042-8add8743b910',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Justin' AND last_name = 'Le'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '525677a9-1d76-40ea-9042-8add8743b910'
WHERE 
  s.first_name = 'Justin' 
  AND s.last_name = 'Le'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );

-- Assign tutor Minah Cho to class UCAT A
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = 'Minah' AND last_name = 'Cho'),
  '525677a9-1d76-40ea-9042-8add8743b910',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = 'Minah' AND last_name = 'Cho'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '525677a9-1d76-40ea-9042-8add8743b910'
WHERE 
  s.first_name = 'Minah' 
  AND s.last_name = 'Cho'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );
