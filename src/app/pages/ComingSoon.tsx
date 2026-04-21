import { useNavigate, useLocation } from "react-router";
import { Button } from "../components/ui/button";
import { ArrowLeft, Bell, Sparkles, Calendar, CheckCircle, CreditCard, Plane, Building2 } from "lucide-react";

interface ComingSoonState {
  service: string;
  icon: "flight" | "hotel";
}

export function ComingSoon() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ComingSoonState | undefined;

  const service = state?.service || "This Feature";
  const iconType = state?.icon || "flight";

  const getServiceIcon = () => {
    if (iconType === "hotel") {
      return <Building2 className="w-14 h-14 text-white" strokeWidth={2.5} />;
    }
    // Flight icon
    return <Plane className="w-14 h-14 text-white" strokeWidth={2.5} />;
  };

  const features = [
    "Book directly from the app",
    "Exclusive member discounts",
    "24/7 customer support",
    "Seamless payment integration"
  ];

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-background dark:to-background pb-6">
      {/* Enhanced Header */}
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-12 pb-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <button
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl">Coming Soon</h1>
            <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
          </div>
          <p className="text-sm text-white/90">Exciting new features on the way!</p>
        </div>
      </header>

      <div className="px-6 py-8 space-y-6">
        {/* Main Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-blue-50/50 dark:from-card dark:to-muted/30 border-0 shadow-2xl p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative text-center">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-xl transform hover:scale-105 transition-transform">
              {getServiceIcon()}
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-400 dark:to-primary bg-clip-text text-transparent">
              {service}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              We're building an incredible {service.toLowerCase()} booking experience. 
              Stay tuned for the launch!
            </p>

            {/* Launch Timeline */}
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-muted dark:to-muted/80 border border-blue-200 dark:border-border mb-8">
              <Calendar className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Expected Launch</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-foreground">Q2 2026</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Card */}
        <div className="bg-white dark:bg-card rounded-2xl border-0 shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium dark:text-foreground">What to Expect</h3>
          </div>
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-muted/50 dark:to-muted/30 hover:from-blue-50 hover:to-purple-50/30 transition-all">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-900/40 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-gray-700 dark:text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-1">Get Notified</h3>
                <p className="text-sm text-white/90 mb-4">
                  Be the first to know when we launch. We'll send you an update via push notification.
                </p>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span>Notifications enabled for your account</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <Button
          onClick={() => navigate("/")}
          className="w-full h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 shadow-md rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}