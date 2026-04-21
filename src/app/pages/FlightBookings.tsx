import { useNavigate } from "react-router";
import { ArrowLeft, Plane, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";

export function FlightBookings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background flex flex-col">
      {/* Header */}
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-12 pb-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <button
            onClick={() => navigate("/bookings")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </button>
          <h1 className="text-2xl mb-1">Flight Bookings</h1>
          <p className="text-sm text-white/90">Your upcoming flights</p>
        </div>
      </header>

      {/* Empty State */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-sm w-full text-center">
          {/* Icon Container */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/20 rounded-full blur-2xl opacity-60"></div>
            </div>
            <div className="relative w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-[#1967D2] to-[#114A99] flex items-center justify-center shadow-2xl">
              <Plane className="w-12 h-12 text-white" strokeWidth={2} />
            </div>
          </div>

          {/* Title & Description */}
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-3">
            No Flight Bookings Yet
          </h2>
          <p className="text-sm text-gray-600 dark:text-muted-foreground mb-8 leading-relaxed">
            You haven't booked any flights yet. When you do, they'll appear here for easy access and management.
          </p>

          {/* Coming Soon Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-muted dark:to-muted/80 border border-blue-100 dark:border-border mb-8">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="text-xs text-gray-600 dark:text-muted-foreground">Flight Booking</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-foreground">Coming Soon</p>
            </div>
          </div>

          {/* Features List */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-md p-6 mb-6">
            <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wide mb-4">
              What to Expect
            </p>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                <p className="text-sm text-gray-700 dark:text-foreground">Compare prices from multiple airlines</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                <p className="text-sm text-gray-700 dark:text-foreground">Instant booking confirmation</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                <p className="text-sm text-gray-700 dark:text-foreground">Manage all bookings in one place</p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => navigate("/bookings")}
            variant="outline"
            className="w-full h-12 rounded-xl border-gray-200 dark:border-border"
          >
            Back to Bookings
          </Button>
        </div>
      </div>
    </div>
  );
}
