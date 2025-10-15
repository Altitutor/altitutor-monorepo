Here is a set of guidelines and step-by-step instructions distilled for an AI agent to build a professional dashboard UI, based on the content and best practices explained in the video:

1. Sidebar (Navigation & Global Elements)

Start with a sidebar housing persistent, globally relevant features (navigation links, profile management, search).

Place user profile management (e.g., picture with clickable arrow) at the top; logo placement is optional.

For navigation links, use recognizable icons with short titles.

Support collapsible sidebars and optionally display notification counts or status chips next to links.

Group navigation links by relevance to reduce cognitive load; rarely used items (settings/help) should be at the bottom.

For many links, nest items into dropdowns. Always highlight the active item.

Optional: Add notification regions or integration shortcuts in empty sidebar space.

2. Main Dashboard Layout

Design the layout using strict grids (e.g., two-column, two-row) for clarity and compactness.

Use smaller font sizes and denser spacing than landing pages; visually reflect what's important to the user in the main dashboard area (e.g., project status, financial summary).

Top-most dashboard area should reserve space for key actions (like a dropdown and a creation button).

Display data in simple, clean lists—show relevant info for each record, and consider adding a brief description for each item.

Support “empty states” for lists where no data is present.

3. Interactive Elements & Data Management

Enable micro-interactions: e.g., multi-select for bulk actions, contextual buttons triggered by selections.

Incorporate charts—they should be clear and simple (line graphs, bar charts), with grid lines, numbers, quick summaries, and date selectors.

Use recognizable elements (e.g., favicons) for item identification in charts.

Allow charts to break down data, showing conversions, signups, or key metrics.

4. Modal, Popover, and New Page Handling

Use popovers for nonblocking, simple contextual settings.

Use modals for more complex, blocking UI flows (e.g., creating a new item), and always show confirmation toasts for modal actions.

Support toast notifications for info, warnings, and error states—these should not take over the entire screen.

For large/permanent contexts (e.g., clicking an item for details), redirect to a new page; always include breadcrumbs or back buttons.

5. Core Dashboard Components

Master the four core building blocks:

Lists & Tables: Support separation (space, lines, color) and empower users to search, filter, and sort.

Cards: Use for metrics, charts, notifications. Keep spacing comfortable; choose border or background color based on light/dark mode.

User Inputs: Forms/modal inputs, settings pages—optionally embed forms inside cards for richer tables.

Tabs: Use for page/context switching without sidebar clutter (great for showing different table views, settings sections).

6. Animation & Micro-Interactions

Keep animations focused, quick, and user-centric (e.g., hover states show details, dim irrelevant elements).

Use “optimistic UI”: show instant feedback for user actions, anticipating backend success (e.g., hiding an item immediately on deletion).

7. General UX Principles

Make dashboards simple, aesthetic, and highly usable—avoid information overload and clutter.

Always provide feedback and guide users through the dashboard experience.

Use inspiration and benchmarking tools (like Mobbin) to reference well-organized examples from real apps and dashboards.