---

database-plugin: basic

---

---

database-plugin: basic

---

```yaml:dbfolder
name: new database
description: new description
columns:
  __file__:
    key: __file__
    id: __file__
    input: markdown
    label: File
    accessorKey: __file__
    isMetadata: true
    skipPersist: false
    isDragDisabled: false
    csvCandidate: true
    position: 0
    isHidden: false
    sortIndex: -1
    width: 100
    config:
      enable_media_view: true
      link_alias_enabled: true
      media_width: 100
      media_height: 100
      isInline: true
      task_hide_completed: true
      footer_type: none
      persist_changes: false
  Day:
    input: select
    accessorKey: Day
    key: Day
    id: Day
    label: Day
    position: 100
    skipPersist: false
    isHidden: false
    sortIndex: 1
    width: 124
    isSorted: true
    isSortedDesc: false
    options:
      - { label: "3.Wednesday", value: "3.Wednesday", color: "hsl(125, 95%, 90%)"}
      - { label: "6.Saturday AM", value: "6.Saturday AM", color: "hsl(348, 95%, 90%)"}
      - { label: "6.Saturday PM", value: "6.Saturday PM", color: "hsl(322, 95%, 90%)"}
      - { label: "4.Thursday", value: "4.Thursday", color: "hsl(235, 95%, 90%)"}
      - { label: "7.Sunday PM", value: "7.Sunday PM", color: "hsl(97, 95%, 90%)"}
      - { label: "7.Sunday AM", value: "7.Sunday AM", color: "hsl(165, 95%, 90%)"}
      - { label: "1.Monday", value: "1.Monday", color: "hsl(30, 95%, 90%)"}
      - { label: "2.Tuesday", value: "2.Tuesday", color: "hsl(326, 95%, 90%)"}
      - { label: "1. Monday", value: "1. Monday", color: "hsl(276, 95%, 90%)"}
      - { label: "1. Monday, 3. Wednesday", value: "1. Monday, 3. Wednesday", color: "hsl(123, 95%, 90%)"}
      - { label: "1. Monday, 6. Saturday PM", value: "1. Monday, 6. Saturday PM", color: "hsl(166, 95%, 90%)"}
      - { label: "3. Wednesday", value: "3. Wednesday", color: "hsl(48, 95%, 90%)"}
      - { label: "3. Wednesday, 3. Wednesday", value: "3. Wednesday, 3. Wednesday", color: "hsl(328, 95%, 90%)"}
      - { label: "3. Wednesday, 6. Saturday PM", value: "3. Wednesday, 6. Saturday PM", color: "hsl(79, 95%, 90%)"}
      - { label: "4. Thursday", value: "4. Thursday", color: "hsl(114, 95%, 90%)"}
      - { label: "4. Thursday, 4. Thursday", value: "4. Thursday, 4. Thursday", color: "hsl(351, 95%, 90%)"}
      - { label: "6. Saturday AM", value: "6. Saturday AM", color: "hsl(43, 95%, 90%)"}
      - { label: "6. Saturday AM, 6. Saturday AM", value: "6. Saturday AM, 6. Saturday AM", color: "hsl(159, 95%, 90%)"}
      - { label: "6. Saturday PM", value: "6. Saturday PM", color: "hsl(332, 95%, 90%)"}
      - { label: "6. Saturday PM, 6. Saturday PM", value: "6. Saturday PM, 6. Saturday PM", color: "hsl(91, 95%, 90%)"}
      - { label: "6. Saturday PM, 7. Sunday AM", value: "6. Saturday PM, 7. Sunday AM", color: "hsl(160, 95%, 90%)"}
      - { label: "7. Sunday PM", value: "7. Sunday PM", color: "hsl(75, 95%, 90%)"}
    config:
      enable_media_view: true
      link_alias_enabled: true
      media_width: 100
      media_height: 100
      isInline: false
      task_hide_completed: true
      footer_type: none
      persist_changes: false
  Subject:
    input: select
    accessorKey: Subject
    key: Subject
    id: Subject
    label: Subject
    position: 100
    skipPersist: false
    isHidden: false
    sortIndex: -1
    width: 173
    options:
      - { label: "10MATH", value: "10MATH", color: "hsl(121, 95%, 90%)"}
      - { label: "8MATH", value: "8MATH", color: "hsl(309, 95%, 90%)"}
      - { label: "10SCI", value: "10SCI", color: "hsl(109, 95%, 90%)"}
      - { label: "PreMATH", value: "PreMATH", color: "hsl(212, 95%, 90%)"}
      - { label: "8SCI", value: "8SCI", color: "hsl(242, 95%, 90%)"}
      - { label: "IBECO", value: "IBECO", color: "hsl(184, 95%, 90%)"}
      - { label: "11METH", value: "11METH", color: "hsl(242, 95%, 90%)"}
      - { label: "PreSCI", value: "PreSCI", color: "hsl(250, 95%, 90%)"}
      - { label: "11CHEM", value: "11CHEM", color: "hsl(258, 95%, 90%)"}
      - { label: "6ENG", value: "6ENG", color: "hsl(106, 95%, 90%)"}
      - { label: "6SCI", value: "6SCI", color: "hsl(271, 95%, 90%)"}
      - { label: "11PHYS", value: "11PHYS", color: "hsl(52, 95%, 90%)"}
      - { label: "PreENG", value: "PreENG", color: "hsl(121, 95%, 90%)"}
      - { label: "11BIO", value: "11BIO", color: "hsl(306, 95%, 90%)"}
      - { label: "12BIO", value: "12BIO", color: "hsl(104, 95%, 90%)"}
      - { label: "7ENG", value: "7ENG", color: "hsl(140, 95%, 90%)"}
      - { label: "7MATH", value: "7MATH", color: "hsl(114, 95%, 90%)"}
      - { label: "12SPEC", value: "12SPEC", color: "hsl(309, 95%, 90%)"}
      - { label: "UCAT", value: "UCAT", color: "hsl(208, 95%, 90%)"}
      - { label: "11SPEC", value: "11SPEC", color: "hsl(140, 95%, 90%)"}
      - { label: "12CHEM", value: "12CHEM", color: "hsl(355, 95%, 90%)"}
      - { label: "12METH", value: "12METH", color: "hsl(321, 95%, 90%)"}
      - { label: "12PHYS", value: "12PHYS", color: "hsl(93, 95%, 90%)"}
      - { label: "8ENG", value: "8ENG", color: "hsl(137, 95%, 90%)"}
      - { label: "9MATH", value: "9MATH", color: "hsl(221, 95%, 90%)"}
      - { label: "9SCI", value: "9SCI", color: "hsl(249, 95%, 90%)"}
      - { label: "PreSACE Science", value: "PreSACE Science", color: "hsl(191, 95%, 90%)"}
      - { label: "SACE 11METH", value: "SACE 11METH", color: "hsl(314, 95%, 90%)"}
      - { label: "SACE 11PHYS", value: "SACE 11PHYS", color: "hsl(243, 95%, 90%)"}
      - { label: "SACE 12CHEM", value: "SACE 12CHEM", color: "hsl(323, 95%, 90%)"}
      - { label: "PreSACE Maths", value: "PreSACE Maths", color: "hsl(333, 95%, 90%)"}
      - { label: "SACE 11BIO", value: "SACE 11BIO", color: "hsl(40, 95%, 90%)"}
      - { label: "SACE 12METH", value: "SACE 12METH", color: "hsl(259, 95%, 90%)"}
      - { label: "PreSACE English", value: "PreSACE English", color: "hsl(192, 95%, 90%)"}
      - { label: "IB 12MATH AA SL", value: "IB 12MATH AA SL", color: "hsl(209, 95%, 90%)"}
      - { label: "SACE 12BIO", value: "SACE 12BIO", color: "hsl(215, 95%, 90%)"}
      - { label: "SACE 12SPEC", value: "SACE 12SPEC", color: "hsl(354, 95%, 90%)"}
      - { label: "SACE English", value: "SACE English", color: "hsl(347, 95%, 90%)"}
      - { label: "SACE 12PHYS", value: "SACE 12PHYS", color: "hsl(102, 95%, 90%)"}
      - { label: "SACE 11CHEM", value: "SACE 11CHEM", color: "hsl(5, 95%, 90%)"}
      - { label: "IB ECO", value: "IB ECO", color: "hsl(42, 95%, 90%)"}
      - { label: "IB CHEM", value: "IB CHEM", color: "hsl(8, 95%, 90%)"}
      - { label: "IB MATH", value: "IB MATH", color: "hsl(79, 95%, 90%)"}
      - { label: "IBPHYS", value: "IBPHYS", color: "hsl(32, 95%, 90%)"}
      - { label: "IB BIO", value: "IB BIO", color: "hsl(355, 95%, 90%)"}
      - { label: "SACE 11SPEC", value: "SACE 11SPEC", color: "hsl(108, 95%, 90%)"}
      - { label: "AIF", value: "AIF", color: "hsl(222, 95%, 90%)"}
      - { label: "IB SUBJECTS", value: "IB SUBJECTS", color: "hsl(226, 95%, 90%)"}
    config:
      enable_media_view: true
      link_alias_enabled: true
      media_width: 100
      media_height: 100
      isInline: false
      task_hide_completed: true
      footer_type: none
      persist_changes: false
      option_source: manual
  Time:
    input: select
    accessorKey: Time
    key: Time
    id: Time
    label: Time
    position: 100
    skipPersist: false
    isHidden: false
    sortIndex: 2
    isSorted: true
    isSortedDesc: false
    options:
      - { label: "4:15", value: "4:15", color: "hsl(272, 95%, 90%)"}
      - { label: "5:45", value: "5:45", color: "hsl(336, 95%, 90%)"}
      - { label: "11:00", value: "11:00", color: "hsl(219, 95%, 90%)"}
      - { label: "9:30", value: "9:30", color: "hsl(167, 95%, 90%)"}
      - { label: "1:00", value: "1:00", color: "hsl(174, 95%, 90%)"}
      - { label: "2:30", value: "2:30", color: "hsl(6, 95%, 90%)"}
      - { label: "1:30", value: "1:30", color: "hsl(0, 95%, 90%)"}
      - { label: "2:15", value: "2:15", color: "hsl(211, 95%, 90%)"}
      - { label: "2:45", value: "2:45", color: "hsl(219, 95%, 90%)"}
      - { label: "1:15", value: "1:15", color: "hsl(69, 95%, 90%)"}
      - { label: "2.45pm", value: "2.45pm", color: "hsl(145, 95%, 90%)"}
      - { label: "12:30", value: "12:30", color: "hsl(283, 95%, 90%)"}
      - { label: "2.45", value: "2.45", color: "hsl(69, 95%, 90%)"}
      - { label: "2:00", value: "2:00", color: "hsl(347, 95%, 90%)"}
    config:
      enable_media_view: true
      link_alias_enabled: true
      media_width: 100
      media_height: 100
      isInline: false
      task_hide_completed: true
      footer_type: none
      persist_changes: false
      option_source: manual
  Tutor:
    input: relation
    accessorKey: Tutor
    key: Tutor
    id: Tutor
    label: Tutor
    position: 100
    skipPersist: false
    isHidden: false
    sortIndex: -1
    width: 174
    config:
      enable_media_view: true
      link_alias_enabled: true
      media_width: 100
      media_height: 100
      isInline: true
      task_hide_completed: true
      footer_type: none
      persist_changes: false
      relation_color: hsl(0,0%,47%)
      related_note_path: 1.3 Tutors/Tutors database.md
  __inlinks__:
    key: __inlinks__
    id: __inlinks__
    input: inlinks
    label: Inlinks
    accessorKey: __inlinks__
    isMetadata: true
    isDragDisabled: false
    skipPersist: false
    csvCandidate: false
    width: 190
    position: 0
    isHidden: false
    sortIndex: -1
    config:
      enable_media_view: true
      link_alias_enabled: true
      media_width: 100
      media_height: 100
      isInline: false
      task_hide_completed: true
      footer_type: none
      persist_changes: false
config:
  remove_field_when_delete_column: true
  cell_size: normal
  sticky_first_column: true
  group_folder_column: 
  remove_empty_folders: false
  automatically_group_files: false
  hoist_files_with_empty_attributes: true
  show_metadata_created: false
  show_metadata_modified: false
  show_metadata_tasks: false
  show_metadata_inlinks: true
  show_metadata_outlinks: false
  show_metadata_tags: false
  source_data: current_folder
  source_form_result: 
  source_destination_path: /
  row_templates_folder: Templates
  current_row_template: Templates/Class template.md
  pagination_size: 200
  font_size: 16
  enable_js_formulas: false
  formula_folder_path: /
  inline_default: false
  inline_new_position: last_field
  date_format: yyyy-MM-dd
  datetime_format: "yyyy-MM-dd HH:mm:ss"
  metadata_date_format: "yyyy-MM-dd HH:mm:ss"
  enable_footer: false
  implementation: default
filters:
  enabled: true
  conditions:
      - condition: AND
        disabled: true
        label: "Monday"
        color: "hsl(326, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Monday"
          type: select
      - condition: AND
        disabled: true
        label: "Tuesday"
        color: "hsl(169, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Tuesday"
          type: select
      - condition: AND
        disabled: true
        label: "Wednesday"
        color: "hsl(278, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Wednesday"
          type: select
      - condition: AND
        disabled: true
        label: "Thursday"
        color: "hsl(134, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Thursday"
          type: select
      - condition: AND
        disabled: true
        label: "Friday"
        color: "hsl(126, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Friday"
          type: select
      - condition: AND
        disabled: true
        label: "Sat AM"
        color: "hsl(158, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Saturday AM"
          type: select
      - condition: AND
        disabled: true
        label: "Sat PM"
        color: "hsl(119, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Saturday PM"
          type: select
      - condition: AND
        disabled: true
        label: "Sun AM"
        color: "hsl(219, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Sunday AM"
          type: select
      - condition: AND
        disabled: true
        label: "Sun PM"
        color: "hsl(68, 95%, 90%)"
        filters:
        - field: Day
          operator: CONTAINS
          value: "Sunday PM"
          type: select
```