"use client";

import { useTheme } from "next-themes@0.4.6";
import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

/**
 * TULIP TOAST CONFIGURATION
 * 
 * Enhanced Sonner toast styling aligned with Tulip feedback system.
 * Part of the comprehensive feedback redesign (visual only, no logic changes).
 * 
 * Features:
 * - Gradient backgrounds for each variant (success/error/warning/info)
 * - Rounded corners (rounded-2xl) consistent with Tulip design
 * - Enhanced shadows and spacing for modern look
 * - Brand-aligned action buttons using Tulip primary blue
 * - Icon color customization per variant
 * 
 * Usage:
 * - toast.success("Message") - Green emerald variant
 * - toast.error("Message") - Rose red variant
 * - toast.warning("Message") - Amber yellow variant
 * - toast.info("Message") - Blue sky variant
 * - toast("Message", { description: "Details" }) - With subtitle
 * 
 * See /feedback-system route for complete design reference.
 */

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:backdrop-blur-sm group-[.toaster]:px-5 group-[.toaster]:py-4",
          title: "group-[.toast]:text-base group-[.toast]:font-medium",
          description: "group-[.toast]:text-sm group-[.toast]:text-gray-600 group-[.toast]:mt-1",
          actionButton: "group-[.toast]:bg-[#1967D2] group-[.toast]:text-white group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:font-medium group-[.toast]:shadow-sm",
          cancelButton: "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-700 group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:font-medium",
          success: "group-[.toast]:border-emerald-200/70 group-[.toast]:bg-gradient-to-br group-[.toast]:from-emerald-50 group-[.toast]:to-green-50 group-[.toast]:text-emerald-900 [&_[data-icon]]:text-emerald-600",
          error: "group-[.toast]:border-rose-200/70 group-[.toast]:bg-gradient-to-br group-[.toast]:from-rose-50 group-[.toast]:to-red-50 group-[.toast]:text-rose-900 [&_[data-icon]]:text-rose-600",
          info: "group-[.toast]:border-blue-200/70 group-[.toast]:bg-gradient-to-br group-[.toast]:from-blue-50 group-[.toast]:to-sky-50 group-[.toast]:text-blue-900 [&_[data-icon]]:text-blue-600",
          warning: "group-[.toast]:border-amber-200/70 group-[.toast]:bg-gradient-to-br group-[.toast]:from-amber-50 group-[.toast]:to-yellow-50 group-[.toast]:text-amber-900 [&_[data-icon]]:text-amber-600",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };