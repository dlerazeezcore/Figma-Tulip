# Tulip Feedback System - Design Specification

## Overview

This document outlines the comprehensive feedback system redesign for the Tulip eSIM mobile application. This is a **visual redesign only** with no functional or wiring changes.

## Design Principles

### Visual Language
- **Aligned with Tulip Brand**: Primary blue (#1967D2) with complementary gradients
- **Modern Aesthetic**: Soft gradients, glassmorphic effects, rounded corners
- **Clear Hierarchy**: Icon → Title → Message → Action
- **Mobile-First**: Optimized for touch interactions and small screens
- **Safe-Area Aware**: Respects iOS/Android safe zones and notches

### Accessibility
- **WCAG AA Compliant**: All text meets minimum contrast ratios
- **Touch Targets**: Minimum 44×44px for interactive elements
- **Screen Reader Support**: Proper ARIA labels and roles
- **Motion Sensitivity**: Respects prefers-reduced-motion

## Component System

### 1. Toast/Snackbar (Sonner)
**Purpose**: Temporary, auto-dismissing notifications

**Implementation**: `/src/app/components/ui/sonner.tsx`

**Features**:
- 4-6 second auto-dismiss (configurable)
- Stacks multiple toasts vertically
- Swipe-to-dismiss on mobile
- Position: top-center

**Variants**:
- Success (Emerald 50-600)
- Error (Rose 50-600)
- Warning (Amber 50-600)
- Info (Blue 50-600)

**Usage**:
```tsx
import { toast } from "sonner";

toast.success("Account created successfully");
toast.error("Unable to log in. Please check your credentials");
toast.warning("Your session will expire soon");
toast.info("Processing your request...");

// With description
toast("Logged in successfully", {
  description: "Welcome back to Tulip",
  duration: 4000,
});
```

### 2. AlertCard
**Purpose**: Inline persistent feedback with optional dismiss

**Implementation**: `/src/app/components/ui/feedback.tsx`

**Features**:
- Optional title and icon
- Dismissible or persistent
- Compact and default sizes
- Gradient backgrounds with overlay

**Props**:
```tsx
interface AlertCardProps {
  variant?: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  icon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  size?: "default" | "compact";
}
```

**Usage**:
```tsx
<AlertCard
  variant="success"
  title="Payment Successful"
  message="Your eSIM has been activated and is ready to use."
  icon={true}
  dismissible={true}
  onDismiss={() => console.log("Dismissed")}
/>
```

### 3. StatusBanner
**Purpose**: Full-width section status for system-wide messages

**Implementation**: `/src/app/components/ui/feedback.tsx`

**Features**:
- Full-width, edge-to-edge design
- Centered content with icon
- Gradient overlay effect
- Border top and bottom

**Usage**:
```tsx
<StatusBanner
  variant="info"
  message="New eSIM plans available in 15+ countries"
  icon={true}
/>
```

### 4. CompactFeedback
**Purpose**: Minimal inline variant for tight spaces

**Implementation**: `/src/app/components/ui/feedback.tsx`

**Features**:
- Small circular icon (20px)
- Single-line text
- Minimal padding
- Inline-flex layout

**Usage**:
```tsx
<CompactFeedback 
  variant="success" 
  message="eSIM activated" 
/>
```

## Color Specifications

### Success (Emerald)
```css
Background: linear-gradient(to bottom right, #ecfdf5, #d1fae5)
Border: rgba(167, 243, 208, 0.6)
Icon Background: #10b981
Text: #064e3b
```

### Error (Rose)
```css
Background: linear-gradient(to bottom right, #fff1f2, #ffe4e6)
Border: rgba(254, 205, 211, 0.6)
Icon Background: #f43f5e
Text: #881337
```

### Warning (Amber)
```css
Background: linear-gradient(to bottom right, #fffbeb, #fef3c7)
Border: rgba(253, 230, 138, 0.6)
Icon Background: #f59e0b
Text: #78350f
```

### Info (Blue)
```css
Background: linear-gradient(to bottom right, #eff6ff, #e0f2fe)
Border: rgba(191, 219, 254, 0.6)
Icon Background: #3b82f6
Text: #1e3a8a
```

## Typography

### Toast
- **Title**: Medium 16px (1rem)
- **Description**: Regular 14px (0.875rem)
- **Line Height**: 1.5

### AlertCard
- **Title**: Medium 16px (default), 14px (compact)
- **Message**: Regular 14px (default), 12px (compact)
- **Line Height**: 1.6 (relaxed)

### StatusBanner
- **Message**: Medium 14px
- **Line Height**: 1.5

### CompactFeedback
- **Message**: Medium 14px
- **Line Height**: 1.5

## Spacing & Layout

### Toast
- **Padding**: 20px horizontal, 16px vertical
- **Corner Radius**: 16px (rounded-2xl)
- **Shadow**: shadow-xl
- **Gap**: 12px between icon and text

### AlertCard
- **Padding**: 16px (default), 12px (compact)
- **Corner Radius**: 12px (rounded-xl)
- **Shadow**: shadow-sm
- **Icon Size**: 40px (default), 32px (compact)
- **Icon Corner Radius**: 8px

### StatusBanner
- **Padding**: 24px horizontal, 14px vertical
- **Icon Size**: 32px
- **Gap**: 10px between icon and text

### CompactFeedback
- **Icon Size**: 20px (circular)
- **Gap**: 8px between icon and text

## Animation Specifications

### Enter Animation
```css
Duration: 200-250ms
Timing: ease-out
Transform: translateY(-10px) → translateY(0)
Opacity: 0 → 1
```

### Exit Animation
```css
Duration: 200ms
Timing: ease-in
Transform: translateY(0) → translateY(-10px)
Opacity: 1 → 0
```

### Hover States
```css
Duration: 150ms
Timing: ease
Scale: 1 → 1.05 (icon)
Background: subtle darkening
```

## Microcopy Guidelines

### Tone
- **Short**: Under 60 characters preferred
- **Present Tense**: "Processing..." not "Will process..."
- **Active Voice**: "Please enter your phone number" not "Phone number must be entered"
- **Specific**: "Invalid phone number format" not "Invalid input"
- **Calm**: Professional, not alarming

### Authentication
✅ **Good**:
- "Logged in successfully"
- "Account created successfully"
- "Please enter your phone number"
- "Unable to log in. Please check your credentials"

❌ **Avoid**:
- "Authentication successful" (too formal)
- "An error occurred" (too vague)
- "Login failed" (negative tone)

### Errors
✅ **Good**:
- "Unable to create account. Please try again"
- "Invalid phone number format"
- "Connection lost. Please check your internet"

❌ **Avoid**:
- "Error: 500" (technical jargon)
- "Something went wrong" (unhelpful)
- "Failed" (negative without solution)

### Success
✅ **Good**:
- "Payment successful"
- "eSIM activated"
- "Settings saved"

❌ **Avoid**:
- "Success!" (vague)
- "Operation completed" (robotic)

## Implementation Checklist

### Phase 1: Core Components ✅
- [x] Enhanced Sonner toast configuration
- [x] AlertCard component with all variants
- [x] StatusBanner component
- [x] CompactFeedback component
- [x] Design reference page at /feedback-system

### Phase 2: Microcopy Improvements ✅
- [x] Updated auth success messages
- [x] Improved error messaging
- [x] Consistent tone across toasts

### Phase 3: Documentation ✅
- [x] Component API documentation
- [x] Usage examples and demos
- [x] Design token specifications
- [x] Microcopy guidelines
- [x] Implementation notes

### Phase 4: Integration (Optional)
- [ ] Replace existing feedback patterns with new components
- [ ] Audit all toast messages for microcopy consistency
- [ ] Add AlertCard to checkout flow
- [ ] Add StatusBanner to admin notifications
- [ ] Test with real data and edge cases

## Usage Locations (Recommended)

### Toast (Current)
- ✅ Authentication (login/signup success/error)
- ✅ Profile updates
- Checkout payment confirmations
- eSIM activation status
- Settings save confirmations
- Network errors

### AlertCard (New)
- Checkout flow (payment instructions)
- eSIM installation steps
- Data usage warnings
- Plan expiration notices
- Admin action confirmations
- Support ticket responses

### StatusBanner (New)
- Admin panel system messages
- Maintenance notifications
- New feature announcements
- Region-specific alerts

### CompactFeedback (New)
- Active eSIM count indicators
- Connection status
- List item status badges
- Form validation hints

## Browser & Device Support

### Mobile
- ✅ iOS Safari 14+
- ✅ Chrome Android 90+
- ✅ Samsung Internet 14+

### Desktop (Admin Web)
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Notes for Engineers

1. **No Logic Changes**: All existing toast() calls work exactly the same
2. **Drop-in Replacement**: New components are additive, not breaking
3. **Gradual Migration**: Can replace existing patterns one screen at a time
4. **Backward Compatible**: Sonner toasts enhanced, not replaced
5. **Testing**: View all variants at /feedback-system route

## Questions & Support

For design questions or implementation help:
- View interactive demos at `/feedback-system`
- Check component source at `/src/app/components/ui/feedback.tsx`
- Review toast config at `/src/app/components/ui/sonner.tsx`
- Reference this spec document for details

---

**Version**: 1.0  
**Last Updated**: April 7, 2026  
**Maintained By**: Tulip Design System Team
