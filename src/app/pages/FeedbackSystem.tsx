import { ChevronLeft, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { AlertCard, StatusBanner, CompactFeedback } from "../components/ui/feedback";
import { toast } from "sonner";
import { useNavigate } from "react-router";

/**
 * FEEDBACK SYSTEM DESIGN REFERENCE
 * 
 * This page demonstrates all feedback patterns used across Tulip mobile app.
 * 
 * ⚠️ VISUAL REDESIGN ONLY - NO FUNCTIONAL CHANGES
 * 
 * Design Principles:
 * - Consistent with Tulip brand colors (#1967D2)
 * - Modern, clean aesthetic with soft gradients
 * - Clear visual hierarchy (icon → title → message → action)
 * - Accessible contrast ratios (WCAG AA compliant)
 * - Mobile-first, safe-area aware
 * - Subtle animations (200-300ms ease transitions)
 * 
 * Component System:
 * 1. Toast/Snackbar (Sonner library) - Temporary notifications
 * 2. AlertCard - Inline persistent feedback
 * 3. StatusBanner - Full-width section status
 * 4. CompactFeedback - Minimal inline variant
 * 
 * Variants: Success, Error, Warning, Info
 */

export function FeedbackSystem() {
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-background dark:to-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 pt-12 pb-6 bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white shadow-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl">Feedback System</h1>
          <div className="w-10" />
        </div>
        <p className="text-white/80 text-sm mt-2 text-center">
          Design reference for all notification patterns
        </p>
      </header>

      <div className="px-6 py-6 space-y-8">
        {/* Design Note */}
        <Card className="p-5 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-100 dark:border-blue-900/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">ℹ️</span>
            </div>
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Design Reference Only</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                This page showcases visual design patterns. No functional or wiring changes included.
                All components follow Tulip's brand guidelines and mobile-first principles.
              </p>
            </div>
          </div>
        </Card>

        {/* Section 1: Toast Notifications */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-medium mb-1 dark:text-foreground">Toast Notifications</h2>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">
              Temporary messages that appear at the top of the screen and auto-dismiss
            </p>
          </div>

          <Card className="p-5 border-0 shadow-lg space-y-3 bg-white dark:bg-card">
            <Button
              onClick={() => toast.success("Account created successfully")}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Show Success Toast
            </Button>

            <Button
              onClick={() => toast.error("Invalid phone number format")}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white"
            >
              Show Error Toast
            </Button>

            <Button
              onClick={() => toast.warning("Your session will expire soon")}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              Show Warning Toast
            </Button>

            <Button
              onClick={() => toast.info("Processing your request...")}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              Show Info Toast
            </Button>

            <Button
              onClick={() => toast("Logged in successfully", {
                description: "Welcome back to Tulip",
                duration: 4000,
              })}
              className="w-full bg-gradient-to-r from-[#1967D2] to-blue-600 text-white"
            >
              Show Toast with Description
            </Button>
          </Card>

          {/* Toast Usage Example */}
          <Card className="p-4 border-0 shadow-md bg-gray-50 dark:bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 dark:text-muted-foreground">USAGE EXAMPLE</span>
              <button
                onClick={() => copyToClipboard('toast.success("Account created successfully")', "toast-1")}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-accent transition-colors"
              >
                {copiedCode === "toast-1" ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                )}
              </button>
            </div>
            <pre className="text-xs text-gray-700 dark:text-foreground overflow-x-auto">
              <code>{`toast.success("Account created successfully");
toast.error("Invalid phone number format");
toast.warning("Your session will expire soon");
toast.info("Processing your request...");`}</code>
            </pre>
          </Card>
        </section>

        {/* Section 2: Alert Cards */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-medium mb-1 dark:text-foreground">Alert Cards</h2>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">
              Inline persistent feedback with optional dismiss action
            </p>
          </div>

          <div className="space-y-3">
            <AlertCard
              variant="success"
              title="Payment Successful"
              message="Your eSIM has been activated and is ready to use."
              icon={true}
            />

            <AlertCard
              variant="error"
              title="Authentication Failed"
              message="Please check your phone number and password, then try again."
              icon={true}
              dismissible={true}
            />

            <AlertCard
              variant="warning"
              title="Low Data Balance"
              message="You have less than 100MB remaining. Consider topping up to avoid service interruption."
              icon={true}
              dismissible={true}
            />

            <AlertCard
              variant="info"
              title="eSIM Installation"
              message="Scan the QR code with your device camera to install the eSIM profile."
              icon={true}
            />

            {/* Compact variant */}
            <AlertCard
              variant="success"
              message="Settings saved"
              icon={true}
              size="compact"
              dismissible={true}
            />
          </div>

          {/* Alert Card Usage Example */}
          <Card className="p-4 border-0 shadow-md bg-gray-50 dark:bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600 dark:text-muted-foreground">USAGE EXAMPLE</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    '<AlertCard\n  variant="success"\n  title="Payment Successful"\n  message="Your eSIM has been activated."\n  icon={true}\n  dismissible={true}\n/>',
                    "alert-1"
                  )
                }
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-accent transition-colors"
              >
                {copiedCode === "alert-1" ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                )}
              </button>
            </div>
            <pre className="text-xs text-gray-700 dark:text-foreground overflow-x-auto">
              <code>{`<AlertCard
  variant="success"
  title="Payment Successful"
  message="Your eSIM has been activated."
  icon={true}
  dismissible={true}
/>`}</code>
            </pre>
          </Card>
        </section>

        {/* Section 3: Status Banners */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-medium mb-1 dark:text-foreground">Status Banners</h2>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">
              Full-width section status for important system-wide messages
            </p>
          </div>

          <div className="space-y-3 -mx-6">
            <StatusBanner
              variant="success"
              message="All systems operational"
              icon={true}
            />

            <StatusBanner
              variant="error"
              message="Service temporarily unavailable"
              icon={true}
            />

            <StatusBanner
              variant="warning"
              message="Scheduled maintenance in 24 hours"
              icon={true}
            />

            <StatusBanner
              variant="info"
              message="New eSIM plans available in 15+ countries"
              icon={true}
            />
          </div>
        </section>

        {/* Section 4: Compact Feedback */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-medium mb-1">Compact Feedback</h2>
            <p className="text-sm text-gray-600">
              Minimal inline variant for tight spaces
            </p>
          </div>

          <Card className="p-5 border-0 shadow-lg space-y-3">
            <CompactFeedback variant="success" message="eSIM activated" />
            <CompactFeedback variant="error" message="Failed to load" />
            <CompactFeedback variant="warning" message="Connection unstable" />
            <CompactFeedback variant="info" message="2 active eSIMs" />
          </Card>
        </section>

        {/* Section 5: Microcopy Guidelines */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-medium mb-1">Microcopy Best Practices</h2>
            <p className="text-sm text-gray-600">
              Consistent tone and messaging across the app
            </p>
          </div>

          <Card className="p-5 border-0 shadow-lg">
            <div className="space-y-4">
              <div className="pb-3 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Authentication Success</h3>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 text-xs mt-0.5">✓</span>
                    <span className="text-sm text-gray-700">"Logged in successfully"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 text-xs mt-0.5">✓</span>
                    <span className="text-sm text-gray-700">"Account created successfully"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 text-xs mt-0.5">✗</span>
                    <span className="text-sm text-gray-500 line-through">"Authentication successful"</span>
                  </div>
                </div>
              </div>

              <div className="pb-3 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Error Messages</h3>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 text-xs mt-0.5">✓</span>
                    <span className="text-sm text-gray-700">"Please enter your phone number"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 text-xs mt-0.5">✓</span>
                    <span className="text-sm text-gray-700">"Invalid phone number format"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 text-xs mt-0.5">✗</span>
                    <span className="text-sm text-gray-500 line-through">"An error occurred"</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Tone Guidelines</h3>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Keep it short and actionable (under 60 characters)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Use present tense and active voice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Be specific about the issue and solution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Maintain a calm, professional tone</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </section>

        {/* Section 6: Design Tokens */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-medium mb-1">Design Tokens</h2>
            <p className="text-sm text-gray-600">
              Color palette and styling specifications
            </p>
          </div>

          <Card className="p-5 border-0 shadow-lg">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Color Variants</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="h-12 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/60 flex items-center justify-center">
                      <span className="text-xs font-medium text-emerald-900">Success</span>
                    </div>
                    <p className="text-xs text-gray-600">Emerald 50-500</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-12 rounded-lg bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200/60 flex items-center justify-center">
                      <span className="text-xs font-medium text-rose-900">Error</span>
                    </div>
                    <p className="text-xs text-gray-600">Rose 50-500</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-12 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200/60 flex items-center justify-center">
                      <span className="text-xs font-medium text-amber-900">Warning</span>
                    </div>
                    <p className="text-xs text-gray-600">Amber 50-500</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-12 rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200/60 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-900">Info</span>
                    </div>
                    <p className="text-xs text-gray-600">Blue 50-500</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <h3 className="text-sm font-medium mb-2">Typography</h3>
                <div className="space-y-1.5 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Title:</span>
                    <span className="font-medium">Medium 16px</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Message:</span>
                    <span className="font-medium">Regular 14px</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compact:</span>
                    <span className="font-medium">Medium 12-13px</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <h3 className="text-sm font-medium mb-2">Spacing & Effects</h3>
                <div className="space-y-1.5 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Corner radius:</span>
                    <span className="font-medium">12px (rounded-xl)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shadow:</span>
                    <span className="font-medium">shadow-sm to shadow-xl</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Animation:</span>
                    <span className="font-medium">200-300ms ease</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safe area:</span>
                    <span className="font-medium">iOS/Android aware</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Footer Note */}
        <Card className="p-4 border-0 shadow-md bg-gradient-to-br from-gray-50 to-slate-50">
          <p className="text-xs text-gray-600 text-center leading-relaxed">
            This feedback system maintains visual consistency across all Tulip mobile screens
            while preserving existing functionality and wiring. For implementation questions,
            refer to <code className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-800">/src/app/components/ui/feedback.tsx</code>
          </p>
        </Card>
      </div>
    </div>
  );
}
