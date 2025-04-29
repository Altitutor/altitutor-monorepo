-- Migration: Add function to add values to enum types
-- Description: Creates a function to add values to enum types if they don't already exist

CREATE OR REPLACE FUNCTION public.add_enum_value(
  enum_name text,
  new_value text
)
RETURNS void AS $$
DECLARE
  enum_values text[];
  enum_query text;
BEGIN
  -- Check if the value already exists in the enum
  EXECUTE format('SELECT enum_range(NULL::%I)', enum_name) INTO enum_values;
  
  IF new_value = ANY(enum_values) THEN
    RAISE NOTICE 'Value % already exists in enum %', new_value, enum_name;
    RETURN;
  END IF;
  
  -- Add the new value to the enum
  enum_query := format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, new_value);
  EXECUTE enum_query;
  
  RAISE NOTICE 'Successfully added % to enum %', new_value, enum_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 