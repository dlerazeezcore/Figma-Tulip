import React from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, Clock, Filter, SlidersHorizontal, Plane, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/card";
import { format } from "date-fns";
import { useCurrency } from "../../utils/currency";
import { enUS, ar, es, fr } from 'date-fns/locale';

const locales: Record<string, any> = { en: enUS, ar, es, fr, ku: ar };

function formatDuration(mins: number, t: any) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}${t('f_h')} ${m}${t('f_m')}`;
}

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm");
}

export function FlightResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n: i18nInstance } = useTranslation();
  const { formatPrice } = useCurrency();
  const { tripType, dateRange, passengers, cabin, origin, destination, phase = "outbound", outboundSelection } = location.state || {
    tripType: "oneway",
    dateRange: { from: new Date("2024-06-01") },
    passengers: { adults: 1, children: 0, infants: 0 },
    cabin: "Economy",
    phase: "outbound"
  };

  const currentLocale = locales[i18nInstance.language] || locales.en;
  const isRTL = document.documentElement.dir === 'rtl';

  const isReturnPhase = phase === "return";
  const displayOrigin = isReturnPhase ? destination : origin;
  const displayDest = isReturnPhase ? origin : destination;

  const totalPassengers = passengers.adults + passengers.children + passengers.infants;
  const dateText = tripType === "roundtrip" && dateRange?.from && dateRange?.to 
    ? `${format(dateRange.from, "d MMM", { locale: currentLocale })} - ${format(dateRange.to, "d MMM", { locale: currentLocale })}`
    : dateRange?.from ? format(dateRange.from, "d MMM", { locale: currentLocale }) : "1 Jun";

  const flightsToDisplay = mockResults.map(flight => {
    if (isReturnPhase) {
      return {
        ...flight,
        offerId: flight.offerId + "-RET",
        origin: displayOrigin?.code || "DUS",
        destination: displayDest?.code || "EBL",
        departureDateTime: dateRange?.to ? dateRange.to.toISOString() : "2024-06-10T14:00:00Z",
        arrivalDateTime: dateRange?.to ? new Date(dateRange.to.getTime() + 2 * 60 * 60 * 1000).toISOString() : "2024-06-10T16:30:00Z"
      };
    }
    return {
      ...flight,
      origin: displayOrigin?.code || "EBL",
      destination: displayDest?.code || "DUS",
    };
  });

  const handleSelect = (flight: typeof mockResults[0]) => {
    const nextState = { ...location.state, currentOfferId: flight.offerId, currentBasePrice: flight.basePrice };
    
    if (flight.hasFareFamilies) {
      navigate(`/flights/fare-families/${flight.offerId}`, { state: nextState });
    } else {
      const isRoundTripOutbound = tripType === "roundtrip" && phase === "outbound";
      if (isRoundTripOutbound) {
        navigate("/flights/results", { 
          state: {
            ...location.state,
            phase: "return",
            outboundSelection: { offerId: flight.offerId, basePrice: flight.basePrice }
          }
        });
      } else {
        navigate("/flights/summary", {
          state: {
            ...location.state,
            [phase === "outbound" ? "outboundSelection" : "returnSelection"]: { offerId: flight.offerId, basePrice: flight.basePrice }
          }
        });
      }
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-background">
      {/* Sticky Header with Search Summary */}
      <header className="sticky top-0 z-20 bg-white dark:bg-card border-b border-gray-100 dark:border-border shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate(-1)} className="p-2 -ms-2 rounded-full hover:bg-gray-100 dark:hover:bg-muted transition-colors">
              {isRTL ? <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" /> : <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight">{displayOrigin?.code || "EBL"}</h1>
                <ArrowLeft className={`w-3 h-3 text-gray-400 ${isRTL ? 'rotate-0' : 'rotate-180'}`} />
                <h1 className="text-base font-semibold tracking-tight">{displayDest?.code || "DUS"}</h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {dateText} • {t('traveler_count', { count: totalPassengers })} • {t(cabin)}
              </p>
            </div>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm font-semibold text-primary px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
            {t("Edit")}
          </button>
        </div>
        
        {tripType === "roundtrip" && (
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-blue-100 dark:border-blue-900/40 flex justify-between items-center">
             <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                {phase === "outbound" ? t("Step 1 of 2: Outbound") : t("Step 2 of 2: Return")}
             </span>
          </div>
        )}
      </header>

      <main className="p-4 space-y-4">
        {isReturnPhase && outboundSelection && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">{t("Selected Outbound")}</p>
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl p-3 flex justify-between items-center opacity-80">
                <div className="flex gap-2 items-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500"/>
                  <div className="text-start">
                    <span className="text-sm font-semibold">{origin?.code || "EBL"} → {destination?.code || "DUS"}</span>
                    <p className="text-xs text-gray-500 font-medium">{t("Selected")} • {formatPrice(outboundSelection.basePrice)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate(-1)} 
                  className="text-xs font-semibold text-primary px-3 rounded-full py-1.5 bg-blue-50 dark:bg-blue-900/20"
                >
                  {t("Edit")}
                </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-gray-500 font-medium">
            {t('flights_found_count', { count: flightsToDisplay.length, phase: t(phase) })}
          </p>
          <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 py-1.5 px-3 rounded-full hover:bg-gray-200 dark:hover:bg-muted transition-colors bg-white dark:bg-card shadow-sm border border-gray-100 dark:border-border">
            <SlidersHorizontal className="w-4 h-4" />
            {t("Sort & Filter")}
          </button>
        </div>

        {flightsToDisplay.map((flight) => (
          <Card 
            key={flight.offerId} 
            className="p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 dark:border-border/60 group active:scale-[0.98] bg-white dark:bg-card"
            onClick={() => handleSelect(flight)}
          >
            {/* Top row: Airline / Badges */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-muted flex items-center justify-center overflow-hidden font-bold text-[10px] text-gray-500">
                  {flight.airlineCode}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{flight.airlineName}</span>
              </div>
              <div className="flex gap-1.5">
                {flight.labels.map(label => (
                  <span key={label} className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {t(label)}
                  </span>
                ))}
              </div>
            </div>

            {/* Middle row: Timeline */}
            <div className="flex justify-between items-center mb-5">
              <div className="text-start">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">{formatTime(flight.departureDateTime)}</p>
                <p className="text-sm text-gray-500 font-medium">{flight.origin}</p>
              </div>

              {/* Connecting line */}
              <div className="flex-1 px-4 flex flex-col items-center text-center">
                <p className="text-xs text-gray-400 mb-1">{formatDuration(flight.durationInMinutes, t)}</p>
                <div className="w-full relative flex items-center justify-center">
                  <div className="h-px w-full bg-gray-300 dark:bg-gray-700 absolute"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 relative z-10 border border-white dark:border-card"></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{flight.stops === 0 ? t("Direct") : t("flight_stops_count", { count: flight.stops })}</p>
              </div>

              <div className="text-end">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">{formatTime(flight.arrivalDateTime)}</p>
                <p className="text-sm text-gray-500 font-medium">{flight.destination}</p>
              </div>
            </div>

            {/* Bottom row: Price */}
            <div className="flex justify-end items-end pt-3 border-t border-gray-100 dark:border-border">
              <div className="text-end">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-0.5">{t("From")}</p>
                <p className="text-xl font-extrabold text-[#1967D2] dark:text-[#5e96f2]">{formatPrice(flight.basePrice)}</p>
              </div>
            </div>
          </Card>
        ))}

      </main>
    </div>
  );
}
