export const LEARNING_MODULE_ICON_OPTIONS = [
  // Core / existing
  { value: 'book-open', label: 'Book' },
  { value: 'lightbulb', label: 'Idea' },
  { value: 'target', label: 'Target' },
  { value: 'brain', label: 'Brain' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'compass', label: 'Compass' },
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'file-text', label: 'Document' },

  // Study & writing
  { value: 'graduation-cap', label: 'Graduation' },
  { value: 'school', label: 'School' },
  { value: 'library', label: 'Library' },
  { value: 'pencil', label: 'Pencil' },
  { value: 'pen-line', label: 'Pen' },
  { value: 'highlighter', label: 'Highlighter' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'notebook-pen', label: 'Notebook pen' },
  { value: 'clipboard-list', label: 'Checklist clipboard' },
  { value: 'clipboard-check', label: 'Checked clipboard' },
  { value: 'list-checks', label: 'List checks' },
  { value: 'bookmark', label: 'Bookmark' },
  { value: 'star', label: 'Star' },

  // Timing & pace
  { value: 'clock-3', label: 'Clock' },
  { value: 'timer', label: 'Timer' },
  { value: 'hourglass', label: 'Hourglass' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'zap', label: 'Zap' },
  { value: 'flame', label: 'Flame' },
  { value: 'rocket', label: 'Rocket' },

  // Structure & reasoning
  { value: 'layers', label: 'Layers' },
  { value: 'layout-grid', label: 'Layout grid' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'shapes', label: 'Shapes' },
  { value: 'puzzle', label: 'Puzzle' },
  { value: 'git-branch', label: 'Branch' },
  { value: 'git-fork', label: 'Fork' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'network', label: 'Network' },
  { value: 'split', label: 'Split' },
  { value: 'combine', label: 'Combine' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'refresh-cw', label: 'Refresh' },
  { value: 'infinity', label: 'Infinity' },
  { value: 'link-2', label: 'Link' },
  { value: 'filter', label: 'Filter' },
  { value: 'waypoints', label: 'Waypoints' },
  { value: 'route', label: 'Route' },
  { value: 'map', label: 'Map' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'flag', label: 'Flag' },
  { value: 'focus', label: 'Focus' },
  { value: 'crosshair', label: 'Crosshair' },
  { value: 'aperture', label: 'Aperture' },
  { value: 'radar', label: 'Radar' },
  { value: 'orbit', label: 'Orbit' },
  { value: 'arrow-left-right', label: 'Compare' },

  // Reading / verbal
  { value: 'eye', label: 'Eye' },
  { value: 'search', label: 'Search' },
  { value: 'scan', label: 'Scan' },
  { value: 'scan-search', label: 'Scan search' },
  { value: 'quote', label: 'Quote' },
  { value: 'message-square', label: 'Message' },
  { value: 'message-square-text', label: 'Message text' },
  { value: 'messages-square', label: 'Messages' },
  { value: 'info', label: 'Info' },
  { value: 'help-circle', label: 'Help' },

  // Quantitative
  { value: 'percent', label: 'Percent' },
  { value: 'sigma', label: 'Sigma' },
  { value: 'pi', label: 'Pi' },
  { value: 'binary', label: 'Binary' },
  { value: 'hash', label: 'Hash' },
  { value: 'braces', label: 'Braces' },
  { value: 'ruler', label: 'Ruler' },
  { value: 'table-2', label: 'Table' },
  { value: 'grid-3x3', label: 'Grid' },
  { value: 'bar-chart-3', label: 'Bar chart' },
  { value: 'line-chart', label: 'Line chart' },
  { value: 'pie-chart', label: 'Pie chart' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'circle-dot', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'hexagon', label: 'Hexagon' },

  // Situational / people
  { value: 'scale', label: 'Scale' },
  { value: 'users', label: 'Users' },
  { value: 'user-check', label: 'User check' },
  { value: 'user-round-check', label: 'Verified user' },
  { value: 'heart-handshake', label: 'Handshake' },
  { value: 'shield-check', label: 'Shield' },
  { value: 'hand', label: 'Hand' },
  { value: 'pointer', label: 'Pointer' },
  { value: 'footprints', label: 'Footprints' },

  // Achievement
  { value: 'trophy', label: 'Trophy' },
  { value: 'award', label: 'Award' },
  { value: 'medal', label: 'Medal' },
  { value: 'key-round', label: 'Key' },

  // Science / medicine (UCAT context)
  { value: 'atom', label: 'Atom' },
  { value: 'dna', label: 'DNA' },
  { value: 'microscope', label: 'Microscope' },
  { value: 'flask-conical', label: 'Flask' },
  { value: 'stethoscope', label: 'Stethoscope' },
  { value: 'activity', label: 'Activity' },
  { value: 'heart-pulse', label: 'Heart pulse' },
  { value: 'cpu', label: 'CPU' },

  // Media
  { value: 'play-circle', label: 'Play' },
  { value: 'video', label: 'Video' },
  { value: 'headphones', label: 'Headphones' },
  { value: 'wand-2', label: 'Wand' },
] as const

export type LearningModuleIconKey = (typeof LEARNING_MODULE_ICON_OPTIONS)[number]['value']

export function isLearningModuleIconKey(value: unknown): value is LearningModuleIconKey {
  return LEARNING_MODULE_ICON_OPTIONS.some((option) => option.value === value)
}
