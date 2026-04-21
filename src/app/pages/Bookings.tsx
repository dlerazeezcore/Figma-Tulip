import { useNavigate } from "react-router";
import { CreditCard, Plane, Building2, ChevronRight, Package, Clipboard } from "lucide-react";

export function Bookings() {
  const navigate = useNavigate();

  const handleServiceClick = (service: "esim" | "flight" | "hotel") => {
    if (service === "esim") {
      navigate("/my-esims");
    } else if (service === "flight") {
      navigate("/bookings/flights");
    } else {
      navigate("/bookings/hotels");
    }
  };

  const services = [
    {
      key: "esim" as const,
      icon: CreditCard,
      title: "My eSIM Plans",
      subtitle: "View your active eSIMs",
      accentFrom: "#1967D2",
      accentTo: "#114A99",
      bgAccent: "bg-blue-50",
      borderAccent: "border-blue-100",
    },
    {
      key: "flight" as const,
      icon: Plane,
      title: "My Flights",
      subtitle: "Manage flight bookings",
      accentFrom: "#7C3AED",
      accentTo: "#5B21B6",
      bgAccent: "bg-violet-50",
      borderAccent: "border-violet-100",
    },
    {
      key: "hotel" as const,
      icon: Building2,
      title: "My Hotels",
      subtitle: "View hotel reservations",
      accentFrom: "#0D9488",
      accentTo: "#0F766E",
      bgAccent: "bg-teal-50",
      borderAccent: "border-teal-100",
    },
  ];

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background">
      {/* Bookings Header - Consistent with brand gradient */}
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-12 pb-8 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-lg">
              <Clipboard className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl">My Bookings</h1>
              <p className="text-sm text-white/90 mt-0.5">Manage all your travel services</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        {/* Category label */}
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-xs tracking-wide text-gray-400 uppercase">Your Services</span>
        </div>

        {/* Service cards — each with its own color identity */}
        <div className="space-y-3">
          {services.map((svc) => {
            const Icon = svc.icon;
            return (
              <button
                key={svc.key}
                onClick={() => handleServiceClick(svc.key)}
                className="w-full group text-left"
              >
                <div
                  className={`relative rounded-2xl border ${svc.borderAccent} dark:border-border ${svc.bgAccent}/40 dark:bg-card/50 hover:shadow-md transition-all active:scale-[0.98] overflow-hidden`}
                >
                  <div className="relative p-4 flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
                        style={{
                          background: `linear-gradient(135deg, ${svc.accentFrom}, ${svc.accentTo})`,
                        }}
                      >
                        <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-foreground mb-0.5">{svc.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground">{svc.subtitle}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}