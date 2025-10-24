-- ========================
-- RESOURCES SCHEMA OVERHAUL
-- Drop old tables, restructure topics, create topics_files and files tables
-- ========================

-- Drop sessions_resource_files table (no longer needed)
DROP TABLE IF EXISTS sessions_resource_files CASCADE;

-- Drop subtopics table (merged into topics)
DROP TABLE IF EXISTS subtopics CASCADE;

-- Backup and drop resource_files (will be recreated as topics_files)
DROP TABLE IF EXISTS resource_files CASCADE;

-- ========================
-- ALTER TOPICS TABLE
-- ========================

-- Add new columns to topics
ALTER TABLE topics 
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS index INTEGER,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff(id);

-- Set default index values for existing topics
UPDATE topics SET index = number WHERE index IS NULL;

-- Make index NOT NULL after setting values
ALTER TABLE topics ALTER COLUMN index SET NOT NULL;

-- Drop old columns
ALTER TABLE topics DROP COLUMN IF EXISTS area;
ALTER TABLE topics DROP COLUMN IF EXISTS number;

-- Add constraint: if parent_id is not null, subject_id must match parent's subject_id
-- This will be enforced via a trigger since CHECK constraints can't use subqueries

-- Create function to validate parent-child subject match
CREATE OR REPLACE FUNCTION validate_topic_parent_subject()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM topics 
      WHERE id = NEW.parent_id 
      AND subject_id = NEW.subject_id
    ) THEN
      RAISE EXCEPTION 'Topic parent must have the same subject_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS validate_topic_parent_subject_trigger ON topics;
CREATE TRIGGER validate_topic_parent_subject_trigger
  BEFORE INSERT OR UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION validate_topic_parent_subject();

-- Drop old unique constraint if it exists
ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_subject_id_number_key;

-- Add new unique constraint on (subject_id, parent_id, index)
-- Handle NULL parent_id with a partial unique index
DROP INDEX IF EXISTS topics_subject_parent_index_unique;
CREATE UNIQUE INDEX topics_subject_parent_index_unique 
  ON topics(subject_id, parent_id, index) 
  WHERE parent_id IS NOT NULL;

-- Separate unique index for root topics (parent_id IS NULL)
DROP INDEX IF EXISTS topics_subject_root_index_unique;
CREATE UNIQUE INDEX topics_subject_root_index_unique 
  ON topics(subject_id, index) 
  WHERE parent_id IS NULL;

-- ========================
-- CREATE FILES TABLE
-- ========================

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mimetype TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  metadata JSONB,
  storage_provider TEXT NOT NULL DEFAULT 'supabase',
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES staff(id)
);

-- Create indexes on files
CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_storage_provider ON files(storage_provider);

-- ========================
-- CREATE TOPICS_FILES TABLE
-- ========================

CREATE TABLE IF NOT EXISTS topics_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  type resource_type NOT NULL,
  index INTEGER NOT NULL,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  is_solutions BOOLEAN NOT NULL DEFAULT false,
  is_solutions_of_id UUID REFERENCES topics_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES staff(id)
);

-- Create indexes on topics_files
CREATE INDEX IF NOT EXISTS idx_topics_files_topic_id ON topics_files(topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_files_file_id ON topics_files(file_id);
CREATE INDEX IF NOT EXISTS idx_topics_files_is_solutions_of_id ON topics_files(is_solutions_of_id);
CREATE INDEX IF NOT EXISTS idx_topics_files_created_by ON topics_files(created_by);

-- Add unique constraint on (topic_id, type, index, is_solutions)
ALTER TABLE topics_files 
  ADD CONSTRAINT topics_files_topic_type_index_solutions_unique 
  UNIQUE (topic_id, type, index, is_solutions);

-- ========================
-- ADD RLS POLICIES (ADMIN ONLY)
-- ========================

-- Enable RLS on all tables
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS admin_all_topics ON topics;
DROP POLICY IF EXISTS admin_all_files ON files;
DROP POLICY IF EXISTS admin_all_topics_files ON topics_files;

-- Topics policies (admin-only)
CREATE POLICY admin_all_topics ON topics
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMIN'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMIN'
  );

-- Files policies (admin-only)
CREATE POLICY admin_all_files ON files
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMIN'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMIN'
  );

-- Topics_files policies (admin-only)
CREATE POLICY admin_all_topics_files ON topics_files
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMIN'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMIN'
  );

-- ========================
-- ADD UPDATED_AT TRIGGERS
-- ========================

-- Create trigger for topics (if not exists)
DROP TRIGGER IF EXISTS set_updated_at_topics ON topics;
CREATE TRIGGER set_updated_at_topics
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create trigger for files
DROP TRIGGER IF EXISTS set_updated_at_files ON files;
CREATE TRIGGER set_updated_at_files
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create trigger for topics_files
DROP TRIGGER IF EXISTS set_updated_at_topics_files ON topics_files;
CREATE TRIGGER set_updated_at_topics_files
  BEFORE UPDATE ON topics_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ========================

-- Topics indexes
CREATE INDEX IF NOT EXISTS idx_topics_parent_id ON topics(parent_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by);

-- Composite index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_topics_subject_parent ON topics(subject_id, parent_id);

