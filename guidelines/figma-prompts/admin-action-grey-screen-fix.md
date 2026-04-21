## Prompt Header

- Feature name: Admin user actions stability fix
- Screen/page: Admin Panel -> Signed Users table
- Goal: Prevent grey-screen lock when opening Actions menu or Edit action dialog
- Constraints: Keep existing visual style and table layout unchanged

## Figma Prompt (Copy/Paste)

```text
Design update for Admin user actions stability on Admin Panel / Signed Users.

Objective:
- Keep current professional table design
- Ensure action interactions never leave a blocked grey overlay state

Scope:
- Signed Users table action trigger ("Actions")
- Action menu open/close behavior
- Edit user dialog open/close layering behavior
- Out of scope: other admin sections and backend data model

Visual direction:
- Match existing Tulip Admin visual language and spacing
- Keep current colors, typography, and component hierarchy

Required UI structure:
1. Signed users table with Name / Phone Number / Date Registered / Action
2. Per-row action trigger and menu
3. Edit user modal dialog

Required states:
- Loading rows
- Empty rows
- Action menu open
- Edit dialog open
- Error toast on failed action
- Success toast on completed action

Required interactions:
1. Tap/click Actions opens menu without global page lock
2. Selecting Edit opens modal reliably and closes menu cleanly
3. Closing modal restores full interaction with page and table

Responsive behavior:
- Mobile: action menu and dialog remain accessible, no blocked overlay
- Tablet: same interaction behavior as mobile
- Desktop: same interaction behavior as current admin table

Accessibility:
- Visible focus ring on Actions trigger/menu items
- Keyboard navigation for menu and modal
- ESC closes menu/modal cleanly

Output expected:
- High-fidelity states for default, menu-open, modal-open, and error/success states
```

## Approval Gate

- Prompt accepted by user request: yes
- Scope accepted by user request: yes
- States/interactions accepted by user request: yes