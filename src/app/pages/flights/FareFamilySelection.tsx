import React, { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { ArrowLeft, Check, Info, AlertCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../../utils/currency";

// Mock data to match previous
const currentFlightMockData = {
  offerId: "OFFER-EW-101",
  airlineCode: "EW",
  airlineName: "Eurowings",
  flightNumber: "EW1234",
  origin: "EBL",
  destination: "DUS",
  currency: "EUR",
  fareFamilies: [
    {
      fareId: "FARE-EW-BASIC",
      tierName: "Basic",
      price: 99.00,
      isRecommended: false,
      restrictions: ["No refunds", "Fee for changes"],
      benefits: [
        { type: "personal_item", included: true, description: "1 small personal item" },
        { type: "cabin_bag", included: false, description: "No cabin bag included" },
        { type: "checked_bag", included: false, description: "No checked bag included" }
      ]
    },
    {
      fareId: "FARE-EW-SMART",
      tierName: "Smart",
      price: 149.00,
      isRecommended: true,
      restrictions: ["Fee for changes"],
      benefits: [
        { type: "personal_item", included: true, description: "1 small personal item" },
        { type: "cabin_bag", included: true, description: "1 cabin bag up to 8kg" },
        { type: "checked_bag", included: true, description: "1 checked bag up to 23kg" },
        { type: "seat_selection", included: true, description: "Standard seat selection" }
      ]
    },
    {
      fareId: "FARE-EW-BIZ",
      tierName: "Bizclass",
      price: 399.00,
      isRecommended: false,
      restrictions: [],
      benefits: [
        { type: "personal_item", included: true, description: "1 small personal item" },
        { type: "cabin_bag", included: true, description: "2 cabin bags up to 8kg" },
        { type: "checked_bag", included: true, description: "2 checked bags up to 32kg" },
        { type: "flexibility", included: true, description: "Free rebooking and cancellation" }
      ]
    }
  ]
};

export function FareFamilySelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const isRTL = document.documentElement.dir === 'rtl';
  
  const { tripType, phase = "outbound", origin, destination } = location.state || {};
  const isReturnPhase = phase === "return";
  const displayOrigin = isReturnPhase ? destination : origin;
  const displayDest = isReturnPhase ? origin : destination;
  const isRoundTripOutbound = tripType === "roundtrip" && phase === "outbound";

  const [selectedFareId, setSelectedFareId] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedFareId) {
      const fare = currentFlightMockData.fareFamilies.find(f => f.fareId === selectedFareId);
      const selectionData = {
        offerId: id,
        fareId: selectedFareId,
        basePrice: fare?.price || 0,
        fareName: fare?.tierName || ''
      };

      if (isRoundTripOutbound) {
        navigate("/flights/results", {
          state: {
            ...location.state,
            phase: "return",
            outboundSelection: selectionData
          }
        });
      } else {
        navigate("/flights/summary", {
          state: {
            ...location.state,
            [phase === "outbound" ? "outboundSelection" : "returnSelection"]: selectionData
          }
        });
      }
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white dark:bg-card border-b border-gray-100 dark:border-border shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ms-2 rounded-full hover:bg-gray-100 dark:hover:bg-muted transition-colors">
            {isRTL ? <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" /> : <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
          </button>
          <div className="text-start">
            <h1 className="text-base font-semibold tracking-tight">{t("Select Fare")}</h1>
            <p className="text-xs text-gray-500 font-medium">{displayOrigin?.code || "EBL"} → {displayDest?.code || "DUS"} • {currentFlightMockData.airlineName}</p>
          </div>
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
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium px-1 mb-2 text-start">
          {t("airline_fare_options", { airline: currentFlightMockData.airlineName })}
        </p>

        <div className="space-y-4">
          {currentFlightMockData.fareFamilies.map((fare) => {
            const isSelected = selectedFareId === fare.fareId;
            return (
              <div 
                key={fare.fareId}
                onClick={() => setSelectedFareId(fare.fareId)}
                className={`
                  relative p-5 rounded-2xl transition-all cursor-pointer border-2 bg-white dark:bg-card
                  ${isSelected ? "border-[#1967D2] shadow-md dark:border-[#5e96f2]" : "border-gray-100 dark:border-border shadow-sm hover:border-blue-200 dark:hover:border-blue-900"}
                `}
              >
                {/* Recommendation Badge */}
                {fare.isRecommended && (
                  <div className={`absolute -top-3 ${isRTL ? 'left-5' : 'right-5'} bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full shadow-sm`}>
                    {t("Most Popular")}
                  </div>
                )}

                {/* Header Row */}
                <div className="flex justify-between items-start mb-4">
                  <div className="text-start">
                    <h2 className={`text-xl font-bold tracking-tight mb-1 ${isSelected ? "text-[#1967D2] dark:text-[#5e96f2]" : "text-gray-900 dark:text-white"}`}>
                      {t(fare.tierName)}
                    </h2>
                  </div>
                  <div className="text-end">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-0.5">{t("Total")}</p>
                    <p className="text-xl font-extrabold text-gray-900 dark:text-white">{formatPrice(fare.price)}</p>
                  </div>
                </div>

                {/* Benefits List */}
                <div className="space-y-3 mb-4">
                  {fare.benefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      {b.included ? (
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                          <X className="w-4 h-4 text-gray-300 dark:text-gray-600" strokeWidth={3} />
                        </div>
                      )}
                      <span className={`text-sm font-medium text-start ${b.included ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500 line-through decoration-gray-300 dark:decoration-gray-600"}`}>
                        {t(b.description)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Restrictions */}
                {fare.restrictions.length > 0 && (
                  <div className="pt-3 border-t border-gray-100 dark:border-border/60">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      <AlertCircle className="w-3.5 h-3.5" /> {t("Restrictions")}
                    </div>
                    {fare.restrictions.map((r, i) => (
                      <p key={i} className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 leading-snug tracking-tight text-start">
                        • {t(r)}
                      </p>
                    ))}
                  </div>
                )}
                
                {/* Visual affordance for selection */}
                <div className={`
                  mt-4 w-full py-2.5 rounded-xl font-semibold text-sm text-center transition-colors
                  ${isSelected ? "bg-blue-50 text-[#1967D2] dark:bg-blue-900/30 dark:text-blue-300" : "bg-gray-50 text-gray-600 dark:bg-muted dark:text-gray-300"}
                `}>
                  {isSelected ? t("Selected") : t("Select this fare")}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-card/80 backdrop-blur-md border-t border-gray-100 dark:border-border z-30">
        <div className="max-w-md mx-auto">
          <button 
            disabled={!selectedFareId}
            onClick={handleContinue}
            className="w-full bg-[#1967D2] text-white rounded-xl py-3.5 font-semibold text-lg hover:bg-[#1557B0] active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-gray-400 shadow-lg shadow-blue-500/20"
          >
            {isRoundTripOutbound ? t("Continue to Return Flight") : t("Continue to Summary")}
          </button>
        </div>
      </div>
    </div>
  );
}
