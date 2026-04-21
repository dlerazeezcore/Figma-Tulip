# Tulip eSIM Design System

## Overview
This document defines the professional design standards for the **Tulip eSIM mobile-only application**. These standards were established to create a modern, visually engaging interface that balances professionalism with visual appeal - more engaging than a minimal design, but not as extreme as competitor's dark, image-heavy approaches.

**IMPORTANT:** Tulip is exclusively designed for mobile devices. All designs, components, and interactions are optimized for smartphone screens and touch interfaces. This is not a responsive web app - it's a mobile-first, mobile-only experience.

## Core Design Philosophy

### Visual Balance
- **Professional yet modern**: Clean interface with strategic use of gradients and colors
- **Depth without clutter**: Subtle shadows, gradients, and layering for visual interest
- **Mobile-only**: Exclusively optimized for smartphone screens (375-430px width) and touch interfaces
- **Consistent polish**: Every page maintains the same level of professional quality

## Color System

### Primary Brand Colors
```css
--primary: #1967D2           /* Tulip Blue */
--primary-hover: #1557B0     /* Hover state */
--primary-active: #114A99    /* Active state */
```

### Gradient Palette
**Background Gradients:**
- Page backgrounds: `bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30`
- Headers: `bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99]`

**Accent Colors:**
- Blue: `from-blue-100 to-blue-200` (primary actions, info)
- Purple: `from-purple-100 to-purple-200` (premium features)
- Green: `from-green-100 to-green-200` (success, active states)
- Orange: `from-orange-100 to-orange-200` (warnings, data alerts)
- Red: `from-red-100 to-red-200` (errors, dangerous actions)
- Indigo: `from-indigo-100 to-indigo-200` (support, communication)

### Icon Background System
Each functional category gets a specific gradient background:
- **User/Profile**: Blue (`bg-gradient-to-br from-blue-100 to-blue-200`)
- **Communication**: Indigo (`from-indigo-100 to-indigo-200`)
- **Settings**: Purple (`from-purple-100 to-purple-200`)
- **Data/Alerts**: Orange (`from-orange-100 to-orange-200`)
- **Connectivity**: Green (`from-green-100 to-green-200`)
- **Warnings**: Red (`from-red-100 to-red-200`)

## Page Structure Standards

### Headers
**Standard Header Pattern:**
```tsx
<header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-12 pb-8 overflow-hidden">
  {/* Decorative blur elements */}
  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
  
  <div className="relative z-10">
    <h1 className="text-2xl mb-2">{title}</h1>
    <p className="text-sm text-white/80">{subtitle}</p>
  </div>
</header>
```

**Key Features:**
- Multi-tone blue gradient background
- Decorative blur circles for depth
- White text with opacity variations (80% for subtitles)
- Relative z-index layering
- Consistent padding: `px-6 pt-12 pb-8`

### Page Backgrounds
Always use gradient backgrounds:
```tsx
<div className="min-h-full bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30 pb-6">
```

## Component Standards

### Cards
**Enhanced Card Design:**
```tsx
<Card className="border-0 shadow-lg overflow-hidden">
  {/* Optional gradient accent */}
  <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
  {/* Content */}
</Card>
```

**Features:**
- Remove default borders: `border-0`
- Enhanced shadows: `shadow-lg` or `shadow-xl`
- Overflow hidden for clean edges
- Optional gradient accents for visual interest

### Interactive Items
**List Item with Icon Pattern:**
```tsx
<button className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors group">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center group-hover:scale-110 transition-transform">
      <Icon className="w-5 h-5 text-blue-600" />
    </div>
    <div className="text-left">
      <div className="font-medium">{label}</div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  </div>
  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
    <ChevronRight className="w-4 h-4 text-primary" />
  </div>
</button>
```

**Key Elements:**
- 10x10 rounded icon containers with gradients
- Hover scale effect on icons: `group-hover:scale-110`
- Circular chevron container on right
- Smooth transitions on all interactions
- Subtle background change on hover

### Buttons
**Primary Button:**
```tsx
<Button className="h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 shadow-md">
```

**Secondary/Outline:**
```tsx
<Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white shadow-sm">
```

**Destructive:**
```tsx
<Button variant="destructive" className="shadow-md">
```

### Info Rows
**Data Display Pattern:**
```tsx
<div className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
    <Icon className="w-5 h-5 text-blue-600" />
  </div>
  <div className="flex-1 min-w-0">
    <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
    <span className="text-sm font-medium truncate block">{value}</span>
  </div>
</div>
```

## Section Headers

**Consistent Section Header Pattern:**
```tsx
<div className="flex items-center gap-2 mb-3">
  <Icon className="w-4 h-4 text-primary" />
  <h2 className="text-sm font-medium text-gray-700">{title}</h2>
</div>
```

## Animation & Interaction

### Hover Effects
- Cards: `hover:shadow-xl transition-all`
- Scale: `hover:scale-[1.01]` or `hover:scale-110` (for icons)
- Background: `hover:bg-muted/30 transition-colors`
- Icons in containers: `group-hover:scale-110 transition-transform`

### Active States
- Buttons: `active:scale-[0.98]`
- Cards when clickable: `active:scale-[0.98]`

### Transitions
- Default: `transition-colors` or `transition-all`
- Duration: Use defaults or `duration-200`
- Easing: Default Tailwind easing

## Status Indicators

### Active Status Dot
```tsx
<div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
```

### Status Badges
Use existing badge component with variants:
- Success/Active: `variant="success"` (green)
- Warning: `variant="warning"` (orange/yellow)
- Error: `variant="destructive"` (red)
- Info: `variant="default"` (blue)

## Spacing Standards

### Page-level Padding
- Horizontal: `px-6`
- Top (with header): `pt-12`
- Bottom (with nav): `pb-6` or `pb-24` (if floating button)

### Card Padding
- Standard: `p-4` or `p-5`
- Dense: `p-3`
- Spacious: `p-6`

### Section Spacing
- Between sections: `space-y-6` or `space-y-8`
- Within cards: `space-y-3` or `space-y-4`

## Typography

### Headings
- H1 (Page title): `text-2xl mb-2`
- H2 (Section): `text-xl mb-4` or `text-base mb-3` (small sections)
- H3 (Subsection): `text-base` or `text-sm font-medium`

### Body Text
- Default: Inherits from theme
- Muted: `text-muted-foreground`
- Small: `text-sm`
- Extra small: `text-xs`

### Emphasis
- Medium weight: `font-medium` (for labels, emphasis)
- Bold: `font-semibold` or `font-bold` (for important data)

## Shadows

### Elevation System
- Subtle: `shadow-sm` (default cards)
- Medium: `shadow-md` (interactive cards)
- Strong: `shadow-lg` (important cards, modals)
- Extra: `shadow-xl` (featured content)
- Colored: `shadow-primary/30` (for buttons, important actions)

## Rounded Corners

### Standard Sizes
- Small: `rounded-lg` (8px)
- Medium: `rounded-xl` (12px)
- Large: `rounded-2xl` (16px)
- Circle: `rounded-full`

### Usage
- Cards: `rounded-xl`
- Buttons: `rounded-xl` or `rounded-2xl` (primary actions)
- Icons containers: `rounded-xl` (10x10 containers)
- Avatars: `rounded-full`
- Pills/badges: `rounded-full`

## Icon Standards

### Sizes
- Small: `w-4 h-4` (16px) - for inline, badges
- Medium: `w-5 h-5` (20px) - for buttons, list items
- Large: `w-6 h-6` (24px) - for emphasis
- Extra large: `w-8 h-8` to `w-10 h-10` (32-40px) - for headers, empty states

### Icon Container Sizing
- Standard: `w-10 h-10` with `w-5 h-5` icon
- Small: `w-8 h-8` with `w-4 h-4` icon
- Large: `w-12 h-12` with `w-6 h-6` icon

## Image Integration

### Destination Cards
When using background images:
```tsx
<div className="relative">
  <img src={imageUrl} className="w-full h-full object-cover" />
  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40"></div>
  {/* Content on top */}
</div>
```

**Features:**
- Gradient overlays for text readability
- Object-cover for proper scaling
- Dark overlays with varying opacity

## Accessibility

### Touch Targets
- Minimum: 44x44px (iOS standard)
- Recommended: 48x48px
- Buttons: `h-12` minimum (48px)

### Color Contrast
- All text must meet WCAG AA standards
- White text on primary blue: ✅ Passes
- Muted text on light backgrounds: ✅ Passes

### Interactive States
- Always include hover states
- Provide visual feedback for active states
- Clear focus indicators (handled by Tailwind defaults)

## Empty States

**Standard Empty State Pattern:**
```tsx
<div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
  <div className="mb-6">
    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/10 shadow-lg">
      <Icon className="h-10 w-10 text-primary" />
    </div>
    <h2 className="mb-2 text-xl font-medium">{title}</h2>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
  <Button>{action}</Button>
</div>
```

## Loading States

### Spinners
```tsx
<Loader2 className="h-6 w-6 animate-spin text-primary" />
```

### Skeleton Screens
Use when appropriate for better perceived performance (component available in ui/)

## Modal/Dialog Standards

### Standard Dialog
- Max width: `max-w-md` or `max-w-lg`
- Padding: `p-6`
- Rounded corners: `rounded-2xl`
- Backdrop: Default blur effect

## Form Standards

### Input Fields
- Height: `h-12` minimum
- Rounded: `rounded-xl`
- Border: `border-gray-200`
- Focus: `focus:border-primary focus:ring-2 focus:ring-primary/20`

### Labels
- Font: `font-medium`
- Size: `text-sm` or default
- Spacing: `mb-2` below label

## Page-Specific Patterns

### Settings Page
- Profile card elevated above content: `-mt-6 relative z-10 mb-6`
- Grouped sections with themed headers
- Icon-driven navigation items

### Chat/Support
- Gradient empty states
- Bubble-style messages
- Status indicators (typing, online)

### List Pages (eSIMs, Plans)
- Tabs with gradient active states
- Card-based layouts
- Hover effects for interactivity

### Checkout Flow
- Clear visual hierarchy
- Step-by-step progress
- Prominent CTAs

## Quality Checklist

Before considering a page complete, verify:

- [ ] Gradient background applied (`from-gray-50 via-blue-50/30 to-purple-50/30`)
- [ ] Header has multi-tone gradient and decorative elements
- [ ] Cards use `shadow-lg` or `shadow-xl` (not default)
- [ ] Interactive items have hover states
- [ ] Icons use gradient backgrounds with proper colors
- [ ] Buttons use gradient styles for primary actions
- [ ] Section headers include themed icons
- [ ] Proper spacing (px-6, appropriate vertical spacing)
- [ ] All touch targets meet 44x44px minimum
- [ ] Transitions applied to interactive elements
- [ ] Status indicators use proper colors
- [ ] Typography follows size/weight standards
- [ ] Empty states are well designed
- [ ] Loading states are present

## Implementation Notes

### Performance
- Use `backdrop-blur-sm` sparingly (performance cost)
- Optimize images with proper sizing
- Lazy load images when appropriate
- Use CSS transforms for animations (better performance)

### Maintenance
- Keep gradient values consistent across pages
- Use theme variables when available
- Document any new patterns
- Update this guide when design evolves

## Examples

Refer to these pages as gold standards:
- **Settings.tsx** - Perfect example of the elevated design
- **PersonalInformation.tsx** - Clean data display with icons
- **Support.tsx** - Empty states and interactive design
- **Home.tsx** - Image integration and visual hierarchy
- **Plans.tsx** - Gradient sections and card interactions

---

**Last Updated:** Current redesign (April 2026)
**Maintained by:** Tulip eSIM Design Team