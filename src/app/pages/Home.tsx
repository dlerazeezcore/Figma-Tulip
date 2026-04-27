import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Bell, Globe, Signal, CreditCard, Plane, Building2, ChevronRight } from "lucide-react";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { markHomeVisible } from "../wiring/perf-telemetry";
import {
  useHomePageModel,
} from "../wiring/home-page-service";

function formatNumber(value: number): string {
  const rounded = Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatDataLabelFromMb(valueMb: number): string {
  const mb = Math.max(0, Number(valueMb || 0));
  if (mb >= 1024) {
    return `${formatNumber(mb / 1024)}GB`;
  }
  if (mb >= 10) {
    return `${Math.round(mb)}MB`;
  }
  return `${formatNumber(mb)}MB`;
}

export function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    activeEsim,
    dataPercentage,
    welcomeName,
  } = useHomePageModel();

  useEffect(() => {
    markHomeVisible();
  }, []);

  const handleServiceClick = (service: "esim" | "flight" | "hotel") => {
    if (service === "esim") {
      navigate("/plans");
    } else if (service === "flight") {
      navigate("/flights");
    } else {
      navigate("/coming-soon", { 
        state: { 
          service: service === "flight" ? "Flight Booking" : "Hotel Booking",
          icon: service
        } 
      });
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background">
      {/* Enhanced Header with Gradient Background */}
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-8 overflow-hidden texture-noise">
        {/* Enhanced Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-56 h-56 bg-white/3 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl mb-1 tracking-tight">
                {welcomeName ? t("Hey {{name}}!", { name: welcomeName }) : t("Hey there!")}
              </h1>
              <p className="text-sm text-white/95 font-medium">{t("Your world awaits—stay connected anywhere")}</p>
            </div>
            <button className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md hover:bg-white/20 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/5 border border-white/20">
              <Bell className="w-5 h-5" />
            </button>
          </div>

          {activeEsim && (
            <Card className="relative overflow-hidden bg-white/20 backdrop-blur-lg border border-white/30 text-white p-5 shadow-2xl transition-all hover:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.2)] hover:bg-white/25">
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/5 pointer-events-none"></div>

              <div className="relative flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Signal className="w-4 h-4" />
                    <span className="text-xs opacity-90 font-medium">{t("Active")}</span>
                  </div>
                  <h3 className="text-lg mb-0.5 font-semibold tracking-tight">{activeEsim.name}</h3>
                  <p className="text-sm opacity-90 flex items-center gap-1 font-medium">
                    <Globe className="w-3.5 h-3.5" />
                    {activeEsim.country}
                  </p>
                </div>
                <div className="relative">
                  <div className="bg-green-400 w-3 h-3 rounded-full shadow-lg shadow-green-500/60 animate-pulse"></div>
                  <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
                </div>
              </div>

              <div className="relative space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="opacity-90 font-medium">{t("Remaining data")}</span>
                    <span className="font-semibold">
                      {activeEsim.dataTotal > 0
                        ? formatDataLabelFromMb(activeEsim.dataRemaining)
                        : "Unlimited"}
                    </span>
                  </div>
                  <Progress value={dataPercentage} className="h-2.5 bg-white/25" />
                  {activeEsim.dataTotal > 0 && (
                    <p className="text-xs opacity-90 mt-2 font-medium">
                      {formatDataLabelFromMb(activeEsim.dataUsed)} used of {formatDataLabelFromMb(activeEsim.dataTotal)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </header>

      <div className="px-6 py-6">
        {/* Our Services Section - Compact & Professional */}
        <section>
          <div className="mb-4">
            <h2 className="mb-1 dark:text-foreground">{t("Explore Services")}</h2>
            <p className="text-sm text-muted-foreground">{t("Seamless travel solutions")}</p>
          </div>
          
          {/* All Services - Vertical Stack */}
          <div className="space-y-3">
            {/* eSIM - Primary Service */}
            <button
              onClick={() => handleServiceClick("esim")}
              className="w-full group"
            >
              <div className="relative bg-white dark:bg-card rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.12)] transition-all duration-300 active:scale-[0.98] overflow-hidden border border-gray-100/50 dark:border-border">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/10 dark:to-blue-900/20 rounded-full -translate-y-8 translate-x-8 opacity-60 group-hover:opacity-80 transition-opacity"></div>

                <div className="relative p-4 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1967D2] to-[#114A99] flex items-center justify-center shadow-[0_4px_12px_rgba(25,103,210,0.3)] group-hover:shadow-[0_8px_20px_rgba(25,103,210,0.4)] group-hover:scale-105 transition-all">
                      <CreditCard className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 text-start min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-foreground mb-0.5 tracking-tight">{t("eSIM Plans")}</h3>
                    <p className="text-xs text-gray-600 dark:text-muted-foreground font-medium">{t("Browse global data plans")}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            </button>

            {/* Flight Service - Locked/Coming Soon */}
            <div className="w-full relative group opacity-75">
              <div className="relative bg-white dark:bg-card rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden border border-gray-100/50 dark:border-border cursor-not-allowed">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/10 dark:to-blue-900/20 rounded-full -translate-y-8 translate-x-8 opacity-60 transition-opacity"></div>

                <div className="relative p-4 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-lg transition-all">
                      <Plane className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 text-start min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900 dark:text-foreground tracking-tight">{t("Flights")}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 rounded-full uppercase tracking-wider">{t("Soon")}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-muted-foreground font-medium">{t("Book your next adventure")}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-gray-300 transition-all" />
                  </div>
                </div>
              </div>
            </div>

            {/* Hotel Service - Locked/Coming Soon */}
            <div className="w-full relative group opacity-75">
              <div className="relative bg-white dark:bg-card rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden border border-gray-100/50 dark:border-border cursor-not-allowed">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/10 dark:to-blue-900/20 rounded-full -translate-y-8 translate-x-8 opacity-60 transition-opacity"></div>

                <div className="relative p-4 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-lg transition-all">
                      <Building2 className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="flex-1 text-start min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900 dark:text-foreground tracking-tight">{t("Hotels")}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 rounded-full uppercase tracking-wider">{t("Soon")}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-muted-foreground font-medium">{t("Find perfect accommodations")}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-gray-300 transition-all" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
