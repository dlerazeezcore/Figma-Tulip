import * as React from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "./utils";

// ============================================
// TULIP FEEDBACK SYSTEM v1.0
// ============================================
// 
// 🎨 VISUAL REDESIGN ONLY - NO FUNCTIONAL CHANGES
// 
// This feedback component system provides consistent, accessible,
// and visually polished notification patterns across Tulip mobile app.
// 
// DESIGN PRINCIPLES:
// ------------------
// ✓ Aligned with Tulip brand (#1967D2 primary blue)
// ✓ Modern aesthetic with soft gradients and glassmorphic effects
// ✓ Clear visual hierarchy: icon → title → message → action
// ✓ WCAG AA accessible contrast ratios
// ✓ Mobile-first, safe-area aware positioning
// ✓ Subtle animations (200-300ms ease transitions)
// 
// COMPONENT TYPES:
// ----------------
// 1. Toast/Snackbar (via Sonner) - Temporary, auto-dismissing notifications
// 2. AlertCard - Inline persistent feedback with optional dismiss
// 3. StatusBanner - Full-width section status messages
// 4. CompactFeedback - Minimal inline variant for tight spaces
// 
// VARIANTS:
// ---------
// • Success (Emerald) - Confirmations, completed actions
// • Error (Rose) - Critical issues, failed operations
// • Warning (Amber) - Important notices, cautions
// • Info (Blue) - General information, tips
// 
// USAGE EXAMPLES:
// ---------------
// Toast: toast.success("Account created successfully")
// Alert: <AlertCard variant="success" message="..." />
// Banner: <StatusBanner variant="info" message="..." />
// Compact: <CompactFeedback variant="error" message="..." />
// 
// MICROCOPY GUIDELINES:
// ---------------------
// ✓ Keep under 60 characters
// ✓ Use present tense and active voice
// ✓ Be specific about issue and solution
// ✓ Maintain calm, professional tone
// ✓ Examples: "Logged in successfully", "Please enter your phone number"
// 
// IMPLEMENTATION NOTES:
// ---------------------
// • Toast configuration in /src/app/components/ui/sonner.tsx
// • Design reference page at /feedback-system route
// • Color tokens follow Tailwind's emerald/rose/amber/blue scales
// • Animations use CSS transitions for smooth enter/exit
// • Safe area padding handled at component level
// 
// For complete design specs and interactive examples,
// visit /feedback-system in the running application.
// ============================================

export interface AlertCardProps {
  variant?: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  icon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  size?: "default" | "compact";
}

const alertVariants = {
  success: {
    container: "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200/60 dark:border-emerald-900/50",
    iconBg: "bg-emerald-500",
    icon: CheckCircle,
    textColor: "text-emerald-900 dark:text-emerald-200",
    titleColor: "text-emerald-900 dark:text-emerald-100",
    dismissColor: "text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
  },
  error: {
    container: "bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 border-rose-200/60 dark:border-rose-900/50",
    iconBg: "bg-rose-500",
    icon: AlertCircle,
    textColor: "text-rose-900 dark:text-rose-200",
    titleColor: "text-rose-900 dark:text-rose-100",
    dismissColor: "text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/40",
  },
  warning: {
    container: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200/60 dark:border-amber-900/50",
    iconBg: "bg-amber-500",
    icon: AlertTriangle,
    textColor: "text-amber-900 dark:text-amber-200",
    titleColor: "text-amber-900 dark:text-amber-100",
    dismissColor: "text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40",
  },
  info: {
    container: "bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-blue-200/60 dark:border-blue-900/50",
    iconBg: "bg-blue-500",
    icon: Info,
    textColor: "text-blue-900 dark:text-blue-200",
    titleColor: "text-blue-900 dark:text-blue-100",
    dismissColor: "text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40",
  },
};

export function AlertCard({
  variant = "info",
  title,
  message,
  icon = true,
  dismissible = false,
  onDismiss,
  className,
  size = "default",
}: AlertCardProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const variantConfig = alertVariants[variant];
  const IconComponent = variantConfig.icon;

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.();
    }, 200);
  };

  if (!isVisible) return null;

  return (
    <div
      role="alert"
      className={cn(
        "relative overflow-hidden rounded-xl border shadow-sm transition-all duration-200",
        variantConfig.container,
        size === "compact" ? "p-3" : "p-4",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/5 pointer-events-none" />

      <div className="relative flex items-start gap-3">
        {icon && (
          <div
            className={cn(
              "flex-shrink-0 rounded-lg shadow-sm flex items-center justify-center",
              variantConfig.iconBg,
              size === "compact" ? "w-8 h-8" : "w-10 h-10"
            )}
          >
            <IconComponent className={cn("text-white", size === "compact" ? "w-4 h-4" : "w-5 h-5")} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn("font-medium mb-1", variantConfig.titleColor, size === "compact" ? "text-sm" : "text-base")}>
              {title}
            </h4>
          )}
          <p className={cn(variantConfig.textColor, size === "compact" ? "text-xs" : "text-sm", "leading-relaxed")}>
            {message}
          </p>
        </div>

        {dismissible && (
          <button
            onClick={handleDismiss}
            className={cn(
              "flex-shrink-0 rounded-lg transition-all duration-200",
              variantConfig.dismissColor,
              size === "compact" ? "p-1" : "p-1.5"
            )}
            aria-label="Dismiss"
          >
            <X className={size === "compact" ? "w-4 h-4" : "w-4 h-4"} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// STATUS BANNER (Full-width section banner)
// ============================================

export interface StatusBannerProps {
  variant?: "success" | "error" | "warning" | "info";
  message: string;
  icon?: boolean;
  className?: string;
}

export function StatusBanner({ variant = "info", message, icon = true, className }: StatusBannerProps) {
  const variantConfig = alertVariants[variant];
  const IconComponent = variantConfig.icon;

  return (
    <div
      role="status"
      className={cn(
        "relative overflow-hidden border-y shadow-sm",
        variantConfig.container,
        "px-6 py-3.5",
        className
      )}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-white/20 to-transparent dark:from-white/10 dark:via-white/5 pointer-events-none" />
      
      <div className="relative flex items-center justify-center gap-2.5">
        {icon && (
          <div className={cn("flex-shrink-0 rounded-lg shadow-sm flex items-center justify-center w-8 h-8", variantConfig.iconBg)}>
            <IconComponent className="w-4 h-4 text-white" />
          </div>
        )}
        <p className={cn(variantConfig.textColor, "text-sm font-medium text-center")}>
          {message}
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPACT INLINE FEEDBACK (Minimal variant)
// ============================================

export interface CompactFeedbackProps {
  variant?: "success" | "error" | "warning" | "info";
  message: string;
  className?: string;
}

export function CompactFeedback({ variant = "info", message, className }: CompactFeedbackProps) {
  const variantConfig = alertVariants[variant];
  const IconComponent = variantConfig.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex-shrink-0 rounded-full shadow-sm flex items-center justify-center w-5 h-5", variantConfig.iconBg)}>
        <IconComponent className="w-3 h-3 text-white" />
      </div>
      <p className={cn(variantConfig.textColor, "text-sm font-medium")}>
        {message}
      </p>
    </div>
  );
}