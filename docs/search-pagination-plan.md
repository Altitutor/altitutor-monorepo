# Server-Side Search with Pagination - Implementation Plan

## Current Problem

The current implementation has these issues:
1. **Fetches ALL students** when searching (line 207-209) - doesn't scale
2. **Fetches ALL class enrollments** when searching classes (line 171-180) - expensive
3. **Client-side filtering** breaks pagination - total count is wrong
4. **No database-level optimization** - can't use indexes effectively

## Requirements

Search should support:
- ✅ Combined first_name + last_name (e.g., "John Smith")
- ✅ Individual first_name or last_name
- ✅ School name
- ✅ Class short name (e.g., "SACE 12MATH Mon 2:00 PM")
- ✅ Class full name (e.g., "SACE 12 Mathematics Mon 2:00 PM - 4:00 PM")
- ✅ Proper pagination with accurate total count
- ✅ Efficient queries that scale

## Solution Options

### Option 1: PostgreSQL Function (Recommended) ⭐

**Approach**: Create a database function that handles all search logic server-side.

**Pros**:
- ✅ Efficient - runs entirely in database
- ✅ Proper pagination - accurate total counts
- ✅ Can use indexes effectively
- ✅ Reusable across different queries
- ✅ Consistent formatting logic

**Cons**:
- ⚠️ Requires migration
- ⚠️ More complex to maintain
- ⚠️ Need to replicate formatting logic in SQL

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION search_students(
  p_search TEXT,
  p_statuses TEXT[],
  p_curriculums TEXT[],
  p_year_levels INTEGER[],
  p_subject_ids UUID[],
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  students JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_student_ids UUID[];
BEGIN
  v_search_lower := LOWER(TRIM(p_search));
  
  -- Search logic here:
  -- 1. Find students by name/school (using CONCAT for combined names)
  -- 2. Find students by class names (using subquery with formatted class names)
  -- 3. Combine results
  -- 4. Apply other filters
  -- 5. Paginate and return
  
  -- Implementation details below...
END;
$$;
```

### Option 2: SQL with RPC Function

**Approach**: Use Supabase RPC to call a function that returns student IDs matching search.

**Pros**:
- ✅ Server-side execution
- ✅ Can use complex SQL
- ✅ Proper pagination

**Cons**:
- ⚠️ Still need to format class names in SQL
- ⚠️ Two-step process (get IDs, then query)

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION get_student_ids_by_search(
  p_search TEXT
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_name_ids UUID[];
  v_class_ids UUID[];
BEGIN
  v_search_lower := LOWER(TRIM(p_search));
  
  -- Search by concatenated name
  SELECT ARRAY_AGG(id)
  INTO v_name_ids
  FROM students
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%' || v_search_lower || '%'
     OR LOWER(first_name) LIKE '%' || v_search_lower || '%'
     OR LOWER(last_name) LIKE '%' || v_search_lower || '%'
     OR LOWER(school) LIKE '%' || v_search_lower || '%';
  
  -- Search by class names (complex - need to format in SQL)
  -- ... implementation ...
  
  RETURN COALESCE(v_name_ids, ARRAY[]::UUID[]) || COALESCE(v_class_ids, ARRAY[]::UUID[]);
END;
$$;
```

### Option 3: Hybrid SQL Approach (Simplest)

**Approach**: Use Supabase PostgREST queries with SQL functions for class name formatting.

**Pros**:
- ✅ No new functions needed
- ✅ Can use existing Supabase client
- ✅ Simpler migration

**Cons**:
- ⚠️ Still need to format class names in SQL
- ⚠️ More complex queries

**Implementation**:
- Use `CONCAT` for combined name search
- Use subquery with formatted class names
- Apply filters and pagination in single query

## Recommended Approach: Option 1 (PostgreSQL Function)

### Why?

1. **Performance**: All logic runs in database, can use indexes
2. **Accuracy**: Proper pagination with correct total counts
3. **Maintainability**: Single source of truth for search logic
4. **Scalability**: Works with thousands of students

### Implementation Steps

#### Step 1: Create Helper Functions for Class Name Formatting

```sql
-- Format subject short name (matches formatSubjectShortName)
CREATE OR REPLACE FUNCTION format_subject_short_name(
  p_curriculum TEXT,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TRIM(
    CONCAT(
      COALESCE(p_curriculum, ''),
      ' ',
      COALESCE(p_year_level::TEXT, ''),
      UPPER(LEFT(COALESCE(p_name, ''), 4))
    )
  );
$$;

-- Format class short name (matches formatClassShortName)
CREATE OR REPLACE FUNCTION format_class_short_name(
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_curriculum TEXT,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TRIM(
    CONCAT(
      format_subject_short_name(p_curriculum, p_year_level, p_name),
      ' ',
      CASE p_day_of_week
        WHEN 0 THEN 'Sun'
        WHEN 1 THEN 'Mon'
        WHEN 2 THEN 'Tue'
        WHEN 3 THEN 'Wed'
        WHEN 4 THEN 'Thu'
        WHEN 5 THEN 'Fri'
        WHEN 6 THEN 'Sat'
        ELSE ''
      END,
      ' ',
      TO_CHAR(p_start_time, 'HH12:MI AM')
    )
  );
$$;

-- Format class full name (matches formatClassName)
CREATE OR REPLACE FUNCTION format_class_full_name(
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_end_time TIME,
  p_curriculum TEXT,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TRIM(
    CONCAT(
      COALESCE(p_curriculum, ''),
      ' ',
      COALESCE(p_year_level::TEXT, ''),
      ' ',
      COALESCE(p_name, ''),
      ' ',
      CASE p_day_of_week
        WHEN 0 THEN 'Sun'
        WHEN 1 THEN 'Mon'
        WHEN 2 THEN 'Tue'
        WHEN 3 THEN 'Wed'
        WHEN 4 THEN 'Thu'
        WHEN 5 THEN 'Fri'
        WHEN 6 THEN 'Sat'
        ELSE ''
      END,
      ' ',
      TO_CHAR(p_start_time, 'HH12:MI AM'),
      ' - ',
      TO_CHAR(p_end_time, 'HH12:MI AM')
    )
  );
$$;
```

#### Step 2: Create Main Search Function

```sql
CREATE OR REPLACE FUNCTION search_students_minimal(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_curriculums TEXT[] DEFAULT NULL,
  p_year_levels INTEGER[] DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_student_ids UUID[];
  v_result JSONB;
  v_total_count BIGINT;
BEGIN
  -- Normalize search term
  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  
  -- Build student ID list from search
  IF v_search_lower IS NOT NULL THEN
    -- Search by name and school
    SELECT ARRAY_AGG(DISTINCT id)
    INTO v_student_ids
    FROM (
      SELECT id
      FROM students
      WHERE LOWER(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(school, '')) LIKE '%' || v_search_lower || '%'
      
      UNION
      
      -- Search by class names
      SELECT DISTINCT cs.student_id
      FROM classes_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects s ON s.id = c.subject_id
      WHERE cs.unenrolled_at IS NULL
        AND (
          LOWER(format_class_short_name(
            c.day_of_week,
            c.start_time,
            s.curriculum,
            s.year_level,
            s.name
          )) LIKE '%' || v_search_lower || '%'
          OR
          LOWER(format_class_full_name(
            c.day_of_week,
            c.start_time,
            c.end_time,
            s.curriculum,
            s.year_level,
            s.name
          )) LIKE '%' || v_search_lower || '%'
        )
    ) search_results;
  END IF;
  
  -- Build and execute main query
  -- Apply filters, pagination, return results
  -- (Full implementation in migration file)
  
  RETURN v_result;
END;
$$;
```

#### Step 3: Update TypeScript API

```typescript
listMinimal: async (params: {...}) => {
  const { data, error } = await supabase.rpc('search_students_minimal', {
    p_search: params.search || null,
    p_statuses: params.statuses || null,
    p_curriculums: params.curriculums || null,
    p_year_levels: params.yearLevels || null,
    p_subject_ids: params.subjectIds || null,
    p_limit: params.limit || 20,
    p_offset: params.offset || 0,
    p_order_by: params.orderBy || 'last_name',
    p_ascending: params.ascending ?? true,
  });
  
  if (error) throw error;
  return data; // Already formatted as { students: [...], total: number }
}
```

### Performance Considerations

1. **Indexes**: Add indexes for common search patterns
   ```sql
   CREATE INDEX IF NOT EXISTS idx_students_full_name 
   ON students (LOWER(CONCAT(first_name, ' ', last_name)));
   
   CREATE INDEX IF NOT EXISTS idx_students_school_lower 
   ON students (LOWER(school));
   ```

2. **Class Search Optimization**: 
   - Consider materialized view for formatted class names
   - Or use GIN index on formatted text

3. **Caching**: 
   - Function results can be cached
   - Use `STABLE` function attribute

## Migration Plan

1. ✅ Create helper functions for class name formatting
2. ✅ Create main search function
3. ✅ Add performance indexes
4. ✅ Update TypeScript API to use RPC
5. ✅ Test with various search patterns
6. ✅ Deploy and monitor performance

## Testing Checklist

- [ ] Search by combined first_name + last_name
- [ ] Search by individual first_name
- [ ] Search by individual last_name
- [ ] Search by school
- [ ] Search by class short name
- [ ] Search by class full name
- [ ] Pagination works correctly
- [ ] Total count is accurate
- [ ] Filters (status, curriculum, year, subject) work
- [ ] Sorting works
- [ ] Performance is acceptable (< 500ms for 1000+ students)

## Alternative: Simpler SQL Approach

If the function approach is too complex, we can use a simpler SQL query:

```typescript
// Use CONCAT for combined name search
query = query.or(`
  LOWER(CONCAT(first_name, ' ', last_name)).ilike.${q},
  first_name.ilike.${q},
  last_name.ilike.${q},
  school.ilike.${q}
`);

// For class search, use a subquery or separate query
// Then combine results
```

This is simpler but less efficient than a function.



