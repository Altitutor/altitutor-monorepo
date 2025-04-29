-- Migration: Seed subjects table
-- Description: Adds predefined subjects to the subjects table

-- MATHEMATICS subjects
INSERT INTO public.subjects (name, year_level, curriculum, discipline, level)
VALUES
-- SACE MATHEMATICS
('Mathematical Methods', 12, 'SACE', 'MATHEMATICS', NULL),
('Specialist Mathematics', 12, 'SACE', 'MATHEMATICS', NULL),
('General Mathematics', 12, 'SACE', 'MATHEMATICS', NULL),
('Essential Mathematics', 12, 'SACE', 'MATHEMATICS', NULL),
('Mathematical Methods', 11, 'SACE', 'MATHEMATICS', NULL),
('Specialist Mathematics', 11, 'SACE', 'MATHEMATICS', NULL),
('General Mathematics', 11, 'SACE', 'MATHEMATICS', NULL),
('Essential Mathematics', 11, 'SACE', 'MATHEMATICS', NULL),

-- PRESACE MATHEMATICS
('Mathematics', 10, 'PRESACE', 'MATHEMATICS', NULL),
('Mathematics', 9, 'PRESACE', 'MATHEMATICS', NULL),
('Mathematics', 8, 'PRESACE', 'MATHEMATICS', NULL),
('Mathematics', 7, 'PRESACE', 'MATHEMATICS', NULL),

-- PRIMARY MATHEMATICS
('Mathematics', 6, 'PRIMARY', 'MATHEMATICS', NULL),
('Mathematics', 5, 'PRIMARY', 'MATHEMATICS', NULL),
('Mathematics', 4, 'PRIMARY', 'MATHEMATICS', NULL),
('Mathematics', 3, 'PRIMARY', 'MATHEMATICS', NULL),
('Mathematics', 2, 'PRIMARY', 'MATHEMATICS', NULL),
('Mathematics', 1, 'PRIMARY', 'MATHEMATICS', NULL),

-- IB MATHEMATICS
('Mathematics AA', 12, 'IB', 'MATHEMATICS', 'HL'),
('Mathematics AA', 12, 'IB', 'MATHEMATICS', 'SL'),
('Mathematics AI', 12, 'IB', 'MATHEMATICS', 'HL'),
('Mathematics AI', 12, 'IB', 'MATHEMATICS', 'SL'),
('Mathematics AA', 11, 'IB', 'MATHEMATICS', 'HL'),
('Mathematics AA', 11, 'IB', 'MATHEMATICS', 'SL'),
('Mathematics AI', 11, 'IB', 'MATHEMATICS', 'HL'),
('Mathematics AI', 11, 'IB', 'MATHEMATICS', 'SL'),

-- SCIENCE subjects
-- SACE SCIENCE
('Biology', 12, 'SACE', 'SCIENCE', NULL),
('Chemistry', 12, 'SACE', 'SCIENCE', NULL),
('Physics', 12, 'SACE', 'SCIENCE', NULL),
('Biology', 11, 'SACE', 'SCIENCE', NULL),
('Chemistry', 11, 'SACE', 'SCIENCE', NULL),
('Psychology', 12, 'SACE', 'SCIENCE', NULL),
('Psychology', 11, 'SACE', 'SCIENCE', NULL),
('Nutrition', 12, 'SACE', 'SCIENCE', NULL),
('Nutrition', 11, 'SACE', 'SCIENCE', NULL),

-- PRESACE SCIENCE
('Science', 10, 'PRESACE', 'SCIENCE', NULL),
('Science', 9, 'PRESACE', 'SCIENCE', NULL),
('Science', 8, 'PRESACE', 'SCIENCE', NULL),
('Science', 7, 'PRESACE', 'SCIENCE', NULL),

-- PRIMARY SCIENCE
('Science', 6, 'PRIMARY', 'SCIENCE', NULL),
('Science', 5, 'PRIMARY', 'SCIENCE', NULL),
('Science', 4, 'PRIMARY', 'SCIENCE', NULL),
('Science', 3, 'PRIMARY', 'SCIENCE', NULL),
('Science', 2, 'PRIMARY', 'SCIENCE', NULL),
('Science', 1, 'PRIMARY', 'SCIENCE', NULL),

-- IB SCIENCE
('Physics', 12, 'IB', 'SCIENCE', 'HL'),
('Physics', 12, 'IB', 'SCIENCE', 'SL'),
('Chemistry', 12, 'IB', 'SCIENCE', 'HL'),
('Chemistry', 12, 'IB', 'SCIENCE', 'SL'),
('Biology', 12, 'IB', 'SCIENCE', 'HL'),
('Biology', 12, 'IB', 'SCIENCE', 'SL'),
('Physics', 11, 'IB', 'SCIENCE', 'HL'),
('Physics', 11, 'IB', 'SCIENCE', 'SL'),
('Chemistry', 11, 'IB', 'SCIENCE', 'HL'),
('Chemistry', 11, 'IB', 'SCIENCE', 'SL'),
('Biology', 11, 'IB', 'SCIENCE', 'HL'),
('Biology', 11, 'IB', 'SCIENCE', 'SL'),

-- HUMANITIES subjects
-- IB HUMANITIES
('Economics', 12, 'IB', 'HUMANITIES', 'HL'),
('Economics', 12, 'IB', 'HUMANITIES', 'SL'),
('Economics', 11, 'IB', 'HUMANITIES', 'HL'),
('Economics', 11, 'IB', 'HUMANITIES', 'SL'),

-- ENGLISH subjects
-- SACE ENGLISH
('English General', 12, 'SACE', 'ENGLISH', NULL),
('English Literature', 12, 'SACE', 'ENGLISH', NULL),
('English General', 11, 'SACE', 'ENGLISH', NULL),
('English Literature', 11, 'SACE', 'ENGLISH', NULL),

-- PRESACE ENGLISH
('English', 9, 'PRESACE', 'ENGLISH', NULL),
('English', 8, 'PRESACE', 'ENGLISH', NULL),
('English', 7, 'PRESACE', 'ENGLISH', NULL),

-- PRIMARY ENGLISH
('English', 6, 'PRIMARY', 'ENGLISH', NULL),
('English', 5, 'PRIMARY', 'ENGLISH', NULL),
('English', 4, 'PRIMARY', 'ENGLISH', NULL),
('English', 3, 'PRIMARY', 'ENGLISH', NULL),
('English', 2, 'PRIMARY', 'ENGLISH', NULL),
('English', 1, 'PRIMARY', 'ENGLISH', NULL),

-- IB ENGLISH
('English', 12, 'IB', 'ENGLISH', 'HL'),
('English', 12, 'IB', 'ENGLISH', 'SL'),
('English', 11, 'IB', 'ENGLISH', 'HL'),
('English', 11, 'IB', 'ENGLISH', 'SL'),

-- MEDICINE subjects
('UCAT', NULL, NULL, 'MEDICINE', NULL),
('Medicine Interview', NULL, NULL, 'MEDICINE', NULL); 