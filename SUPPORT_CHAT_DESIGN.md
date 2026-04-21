# Tulip Support Chat - UI/UX Design Documentation

## Overview
A thin, mobile-first in-app support chat UI for Tulip eSIM app. This is text-only v1 with clean, minimal design focused on keeping customers inside the app. No backend wiring is included in this design phase.

---

## 1. Profile > Support Entry (Updated)

**Location**: Settings page > Support section  
**Updated Element**: Existing "Chat" entry  

### Visual Design:
```
┌─────────────────────────────────────┐
│ Support                             │ ← Section header (gray)
├─────────────────────────────────────┤
│ [💬] Chat with support         [›] │ ← Updated label
└─────────────────────────────────────┘
```

**Changes Made**:
- Updated label from "Chat" to "Chat with support"
- Navigates to `/support` route
- Uses MessageCircle icon (existing)
- Maintains existing Tulip card styling
- Consistent with other settings items

**Key Features**:
- Premium, lightweight appearance
- Clear call-to-action
- Native to existing information architecture
- No duplicate support entries
- Easy to tap (full-width tappable area)

---

## 2. Main Support Chat Screen

### A. Header (Sticky)
```
┌─────────────────────────────────────┐
│ [←] Support                         │ ← Title
│     Usually replies in a few minutes│ ← Status
└─────────────────────────────────────┘
```

**Specifications**:
- White background with bottom border
- Back button (left): ChevronLeft icon, tappable area -ml-2
- Title: "Support" (text-lg font-medium)
- Status chip: Small gray text (text-xs text-gray-500)
- Sticky positioning (z-10)
- No promises of instant replies

### B. Messages Area (Scrollable)

#### Customer Message Bubble:
```
                  ┌──────────────────┐
                  │ Purchase problem │ ← Customer
                  └──────────────────┘
                             [✓] ← Status icon
```

**Specifications**:
- Right-aligned
- Blue background (bg-primary)
- White text
- Rounded-2xl with rounded-br-md (chat tail effect)
- Max width 75%
- Padding: px-4 py-3
- Status icons: sending (loader), sent (checkmark), failed (retry button)

#### Support Message Bubble:
```
┌──────────────────────────────┐
│ Thanks for reaching out!     │ ← Support
│ A support agent will         │
│ respond soon.                │
└──────────────────────────────┘
```

**Specifications**:
- Left-aligned
- White background with gray border
- Dark text
- Rounded-2xl with rounded-bl-md (chat tail effect)
- Max width 75%
- Padding: px-4 py-3
- Trustworthy, human feel

#### Timestamp Display:
```
        10:30 AM          ← Centered between messages
```

**Logic**:
- Shows timestamp when:
  - First message
  - Different sender from previous
  - >5 minutes since last message
- Text-xs text-gray-500
- Centered

### C. Input Composer (Fixed Bottom)

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────┐  [📤] │
│ │ Type a message...       │        │
│ └─────────────────────────┘        │
└─────────────────────────────────────┘
```

**Specifications**:
- Fixed bottom with safe-area-bottom
- White background with top border
- Textarea: Auto-expanding (max 32px height)
- Rounded-2xl border
- Gray-50 background when focused
- Blue border on focus with ring
- Send button: Circular (w-12 h-12), primary color
- Enter key sends (Shift+Enter for new line)
- Disabled state when empty or sending

---

## 3. Empty State

```
        ┌────────┐
        │   💬   │  ← Icon circle (primary/10)
        └────────┘

    How can we help?

  We're here to help with your
  eSIM plans, activation, or any
  questions about your travel
  connectivity.

  Quick actions:
  ┌─────────────────┐ ┌──────────────┐
  │ Purchase problem│ │Activation...│
  └─────────────────┘ └──────────────┘
  ┌─────────────────┐ ┌──────────────┐
  │ Refund question │ │General...    │
  └─────────────────┘ └──────────────┘
```

**Specifications**:
- Centered vertically and horizontally
- Icon: 64px circle with bg-primary/10
- Chat icon (8x8) in primary color
- Headline: text-xl font-medium
- Description: text-sm text-gray-600
- Quick action chips:
  - White background
  - Gray border (hover: primary border)
  - Rounded-full
  - px-4 py-2
  - Wrap flex layout

**Quick Actions**:
1. "Purchase problem"
2. "Activation issue"
3. "Refund question"
4. "General support"

---

## 4. Message States

### A. Loading Conversation
```
┌─────────────────────────────────────┐
│                                     │
│            [⟳]                      │ ← Spinning loader
│                                     │
└─────────────────────────────────────┘
```
- Centered Loader2 icon
- w-6 h-6 animate-spin
- Gray-400 color

### B. Sending Message
```
                  ┌──────────────────┐
                  │ Hello            │
                  └──────────────────┘
                             [⟳] ← Spinning
```
- Message appears immediately
- Status: "sending"
- Small loader icon bottom-right
- Opacity-70

### C. Message Sent
```
                  ┌──────────────────┐
                  │ Hello            │
                  └──────────────────┘
                             [✓] ← Checkmark
```
- Status: "sent"
- Checkmark icon bottom-right
- Opacity-70

### D. Message Failed
```
                  ┌──────────────────┐
                  │ Hello            │
                  └──────────────────┘
                          Retry ← Button
```
- Status: "failed"
- Clickable "Retry" text
- Red/destructive color
- Re-sends message on tap

### E. Message Delivered
```
                  ┌──────────────────┐
                  │ Hello            │
                  └──────────────────┘
                             [✓✓] ← Double check
```
- Status: "delivered" (future enhancement)
- Double checkmark
- Optional for v1

### F. Support Typing Indicator
```
┌──────────────────────────────┐
│ • • •                        │ ← Animated dots
└──────────────────────────────┘
```
- Support bubble style
- Three dots bouncing animation
- w-2 h-2 bg-gray-400
- Staggered animation delays (0ms, 150ms, 300ms)

### G. Unread Divider (Future)
```
─────── 2 new messages ───────
```
- Horizontal line with text
- Blue color (primary)
- Only shows when returning to chat
- Optional for v1

---

## Visual Design Principles

### Colors (Existing Tulip Palette):
- **Primary**: #1967D2 (blue)
- **Background**: #f9fafb (gray-50)
- **White**: #ffffff
- **Gray borders**: #e5e7eb (gray-200)
- **Text**: #111827 (gray-900)
- **Muted**: #6b7280 (gray-500)

### Typography:
- **Title**: text-lg font-medium
- **Body**: text-sm leading-relaxed
- **Labels**: text-xs
- **Status**: text-xs text-gray-500

### Spacing:
- **Card padding**: p-4
- **Message spacing**: space-y-4
- **Section spacing**: mb-6, mb-8
- **Button height**: h-12 (for main buttons)

### Animations:
- Smooth scrolling to new messages
- Auto-expanding textarea
- Bounce animation for typing dots
- Transition-colors for hover states

---

## Component Structure

```
Support.tsx (Main page)
├── Header (sticky)
│   ├── Back button
│   ├── Title
│   └── Status chip
├── Messages Container (scrollable)
│   ├── Loading state
│   ├── Empty state
│   │   ├── Icon
│   │   ├── Headline
│   │   ├── Description
│   │   └── Quick actions
│   └── Messages list
│       ├── Timestamp
│       ├── Message bubbles
│       │   ├── Customer (right)
│       │   └── Support (left)
│       └── Typing indicator
└── Input Composer (fixed)
    ├── Textarea (auto-resize)
    └── Send button
```

---

## Implementation Notes

### State Management:
```typescript
- messages: Message[]
- inputValue: string
- isLoading: boolean
- isSending: boolean
- supportTyping: boolean
```

### Message Interface:
```typescript
interface Message {
  id: string;
  content: string;
  sender: "customer" | "support";
  timestamp: Date;
  status?: "sending" | "sent" | "failed";
}
```

### Quick Actions Array:
```typescript
const QUICK_ACTIONS = [
  "Purchase problem",
  "Activation issue",
  "Refund question",
  "General support",
];
```

---

## Mobile Optimizations

1. **Safe Area**: Bottom input respects device safe areas
2. **Auto-scroll**: Scrolls to bottom on new messages
3. **Keyboard**: Input resizes with keyboard
4. **Touch targets**: Minimum 44px tap areas
5. **Textarea**: Auto-expands up to max-h-32
6. **Enter key**: Sends message (Shift+Enter for newline)

---

## Future Enhancements (Out of Scope for v1)

1. Image/file attachments
2. Voice messages
3. Rich message formatting
4. Read receipts
5. Agent avatars
6. Conversation history
7. Push notifications
8. Offline mode
9. Message reactions
10. Typing indicators from customer side

---

## Wiring Requirements (Separate Implementation)

The following will be handled in backend/wiring layer:
- Telegram Bot API integration
- WebSocket/polling for real-time messages
- Message persistence
- Authentication/authorization
- Rate limiting
- File upload handling
- Message queue management
- Analytics tracking

---

## Design Files Delivered

1. ✅ Updated Profile > Support entry (Settings.tsx)
2. ✅ Main Support Chat screen (Support.tsx)
3. ✅ Empty state with quick actions
4. ✅ All message states (loading, sending, sent, failed, typing)
5. ✅ Route configuration (routes.ts)
6. ✅ Mobile safe area utilities (global.css)

---

## Design Review Checklist

- [x] Thin, minimal design
- [x] Mobile-first approach
- [x] Premium travel-tech feel
- [x] Consistent with Tulip brand
- [x] No WhatsApp/Telegram branding visible
- [x] Customer stays in app
- [x] Text-only v1
- [x] Lightweight and production-ready
- [x] Reuses existing Profile > Support entry
- [x] Clear visual hierarchy
- [x] Professional spacing
- [x] All message states covered
- [x] Easy to wire later

---

**End of Design Documentation**
