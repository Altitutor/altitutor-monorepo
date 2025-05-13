import os
import re
import glob
import uuid

# Function to extract information from markdown files
def extract_class_info(file_path):
    with open(file_path, 'r') as file:
        content = file.read()
        
        # Extract front matter
        front_matter_match = re.search(r'---\n(.*?)\n---', content, re.DOTALL)
        if not front_matter_match:
            return None
            
        front_matter = front_matter_match.group(1)
        
        # Extract day, subject, and time
        day_match = re.search(r'Day: (.*)', front_matter)
        subject_match = re.search(r'Subject: (.*)', front_matter)
        time_match = re.search(r'Time: (.*)', front_matter)
        
        if not day_match or not subject_match or not time_match:
            return None
        
        day = day_match.group(1).strip()
        subject = subject_match.group(1).strip()
        time = time_match.group(1).strip()
        
        # Extract tutor names
        tutor_match = re.search(r'Tutor:: (.*)', content)
        tutors = []
        
        if tutor_match:
            tutor_line = tutor_match.group(1)
            # Extract names from markdown links
            tutor_names = re.findall(r'\[\[.*?\|(.*?)\]\]', tutor_line)
            tutors = [name.strip() for name in tutor_names]
        
        # Get class ID from filename
        class_id = os.path.basename(file_path).replace('.md', '')
        
        return {
            'class_id': class_id,
            'day': day,
            'subject': subject,
            'time': time,
            'tutors': tutors
        }

# Function to convert time to 24-hour format
def convert_time_to_24h(time_str):
    time_str = time_str.strip('"')  # Remove any quotes
    
    # Handle cases like 11:00
    if ':' in time_str:
        try:
            hour, minute = map(int, time_str.split(':'))
            if hour < 8:  # Assume PM for early hours
                hour += 12
            return f"{hour:02d}:{minute:02d}"
        except ValueError:
            pass
    
    # Handle cases like 5.45 or 2.45
    if '.' in time_str:
        try:
            hour, minute = map(int, time_str.split('.'))
            if hour < 8:  # Assume PM for early hours
                hour += 12
            return f"{hour:02d}:{minute:02d}"
        except ValueError:
            pass
    
    # Handle simple integers like 11
    try:
        hour = int(time_str)
        if hour < 8:  # Assume PM for early hours
            hour += 12
        return f"{hour:02d}:00"
    except ValueError:
        pass
    
    # Default fallback
    return "17:00"  # Default to 5 PM if we can't parse the time

# Generate SQL statements for class insertion
def generate_class_sql(class_info):
    class_uuid = str(uuid.uuid4())
    class_id = class_info['class_id']
    day = class_info['day']
    subject = class_info['subject']
    time = class_info['time']
    
    # Format time as 24-hour time
    time_24h = convert_time_to_24h(time)
    
    # Calculate end time (1 hour after start time)
    try:
        hour, minute = map(int, time_24h.split(':'))
        end_hour = hour + 1
        end_time = f"{end_hour:02d}:{minute:02d}"
    except (ValueError, IndexError):
        end_time = "18:00"  # Default end time
    
    sql = f"""INSERT INTO classes (id, subject, day_of_week, start_time, end_time, status, subject_id) 
VALUES (
  '{class_uuid}', 
  '{class_id}', 
  map_day_to_number('{day}'), 
  '{time_24h}', 
  '{end_time}', 
  'ACTIVE',
  map_subject_to_id('{class_id}')
);

-- Store mapping for tutor assignments
SELECT '{class_uuid}' as class_id, '{class_id}' as class_code;
"""
    
    # Generate tutor assignment SQL
    tutor_sql = ""
    for tutor in class_info['tutors']:
        # Handle tutor names correctly
        tutor_parts = tutor.split()
        first_name = tutor_parts[0]
        last_name = ' '.join(tutor_parts[1:]) if len(tutor_parts) > 1 else ''
        
        # Fix specific tutors with known naming issues
        if tutor == "Livinia Xia-Bednikov":
            first_name = "Livinia"
            last_name = "Xia-Bednorz"
        elif tutor == "Alessia D'Angelis":
            first_name = "Alessia"
            last_name = "D'Angelo"
        
        tutor_sql += f"""
-- Assign tutor {tutor} to class {class_id}
INSERT INTO classes_staff (id, staff_id, class_id, start_date, status)
SELECT 
  uuid_generate_v4(),
  (SELECT id FROM staff WHERE first_name = '{first_name}' AND last_name = '{last_name}'),
  '{class_uuid}',
  CURRENT_DATE,
  'ACTIVE'
WHERE EXISTS (
  SELECT 1 FROM staff WHERE first_name = '{first_name}' AND last_name = '{last_name}'
);

-- Add subject to tutor's subjects if not already assigned
INSERT INTO staff_subjects (staff_id, subject_id)
SELECT 
  s.id,
  c.subject_id
FROM 
  staff s
  JOIN classes c ON c.id = '{class_uuid}'
WHERE 
  s.first_name = '{first_name}' 
  AND s.last_name = '{last_name}'
  AND NOT EXISTS (
    SELECT 1 
    FROM staff_subjects ss 
    WHERE ss.staff_id = s.id 
    AND ss.subject_id = c.subject_id
  );
"""
    
    return sql + tutor_sql

# Main function to process all class files
def main():
    class_files = glob.glob("notes/class-info/*.md")
    class_files = [f for f in class_files if ".DS_Store" not in f and "other" not in f]
    
    all_sql = """-- SQL script to create classes and assign tutors
"""
    
    for file_path in sorted(class_files):
        print(f"Processing {file_path}...")
        class_info = extract_class_info(file_path)
        
        if class_info:
            sql = generate_class_sql(class_info)
            all_sql += f"\n-- Class: {class_info['class_id']} ({class_info['subject']})\n"
            all_sql += sql
        else:
            print(f"Failed to extract information from {file_path}")
    
    # Write SQL to a file
    with open("scripts/create_classes.sql", "w") as output_file:
        output_file.write(all_sql)
    
    print(f"Generated SQL for {len(class_files)} classes")

if __name__ == "__main__":
    main() 