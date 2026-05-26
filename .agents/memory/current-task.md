# Task: Fix Manage Events Page Layout (Strict Senior UI Audit)

## Objective
Correct the "disastrous" layout of the 'Manage Events' page by implementing strict design patterns and consistent Tailwind CSS utility classes.

## Status: ✅ Completed (Bulletproof layout via inline overrides)

## Todo List
- [x] Refine Event Card UI (Premium polish, spacing, padding, and PNG support)
- [ ] Fix Filter Pills (Ensure flex gap and background rendering)
- [ ] Fix Action Buttons (Alignment and height consistency)
- [ ] Standardize Search Bar (Ensure contrast and padding)

## Implementation Plan

### 1. Status Filter Re-design (Toolbar)
- **Container:** Change the filter row to `flex flex-row items-center space-x-2 my-4`.
- **Pills:**
  - Default: `bg-stone-100 text-stone-700 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-stone-200 transition-colors`.
  - Active: `bg-orange-100 text-orange-800`.
- **Removal:** Remove the "Filter Status:" text label or integrate it more subtly.
- **Layout:** Ensure `my-4` vertical margin for consistent rhythm between search and grid.

### 2. Card Content Refinement
- **Container:** Ensure main card padding is `p-5`.
- **Vertical Rhythm:** Apply consistent `mt-4` (or `mt-3` where appropriate) between:
  - Header (Image) -> Content
  - Content -> Quota Progress
  - Quota Progress -> Action Row
- **Typography:** Ensure `text-primary` and `text-secondary` are used correctly for hierarchy.

### 3. Action Buttons Standardization
- **Container:** Wrap buttons in `flex items-center space-x-2 mt-4 pt-4 border-t border-stone-100`.
- **Sizing:** All button containers (Attendance and Icons) must have `h-10`.
- **Attendance Button:** Retain orange primary style but ensure `h-10` and `px-4`.
- **Icon Buttons (Edit/Delete):**
  - Use `w-10 h-10` to match height exactly.
  - Border: `border border-stone-200`.
  - Hover: `hover:bg-stone-50 transition-all`.
  - Alignment: `flex items-center justify-center`.

## Notes
- NO inline styles for layout if possible.
- Use Stone/Orange palette as requested.
- Maintain mobile-first responsiveness.