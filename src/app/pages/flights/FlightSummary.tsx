import React from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, CheckCircle2, Plane, Clock, ShieldCheck, ArrowRightLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/card";
import { format } from "date-fns";
import { useCurrency } from "../../utils/currency";
import { enUS, ar, es, fr } from 'date-fns/locale';

const locales: Record<string, any> = { en: enUS, ar, es, fr, ku: ar };

export function FlightSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n: i18nInstance } = useTranslation();
  const { formatPrice } = useCurrency();
  const isRTL = document.documentElement.dir === 'rtl';
  const currentLocale = locales[i18nInstance.language] || locales.en;

  const { tripType, outboundSelection, returnSelection, origin, destination, dateRange, passengers } = location.state || {
    passengers: { adults: 1, children: 0, infants: 0 }
  };

  const totalPassengers = passengers.adults + passengers.children + passengers.infants;

  // Construct view models from state or fallback to mock
  const outboundLeg = outboundSelection ? {
    airlineName: "Eurowings", // Using mock name
    origin: origin?.code || "EBL",
    destination: destination?.code || "DUS",
    date: dateRange?.from ? new Date(dateRange.from).toISOString() : "2024-06-01T08:00:00Z",
    arrDate: dateRange?.from ? new Date(new Date(dateRange.from).getTime() + 2.5 * 60 * 60 * 1000).toISOString() : "2024-06-01T10:30:00Z",
    hasFareFamilies: !!outboundSelection.fareId,
    fareName: outboundSelection.fareName || "Standard",
    price: outboundSelection.basePrice
  } : null;

  const returnLeg = returnSelection ? {
    airlineName: "Eurowings",
    origin: destination?.code || "DUS",
    destination: origin?.code || "EBL",
    date: dateRange?.to ? new Date(dateRange.to).toISOString() : "2024-06-10T14:00:00Z",
    arrDate: dateRange?.to ? new Date(new Date(dateRange.to).getTime() + 2.5 * 60 * 60 * 1000).toISOString() : "2024-06-10T16:30:00Z",
    hasFareFamilies: !!returnSelection.fareId,
    fareName: returnSelection.fareName || "Standard",
    price: returnSelection.basePrice
  } : null;

  const fallbackFlight = {
    airlineName: "Standard Airways",
    origin: "EBL",
    destination: "DUS",
    date: "2024-06-01T12:00:00Z",
    arrDate: "2024-06-01T14:45:00Z",
    hasFareFamilies: false,
    fareName: "",
    price: 125.00
  };

  const displayOutbound = outboundLeg || fallbackFlight;
  const totalPrice = (outboundLeg?.price || fallbackFlight.price) + (returnLeg?.price || 0);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white dark:bg-card border-b border-gray-100 dark:border-border shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ms-2 rounded-full hover:bg-gray-100 dark:hover:bg-muted transition-colors">
            {isRTL ? <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" /> : <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
          </button>
          <h1 className="text-base font-semibold tracking-tight">{t("Review Trip")}</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        
        {/* Outbound Flight Card */}
          <Card className="p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-border bg-white dark:bg-card">
            <div className="flex justify-between items-center mb-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-100 dark:bg-muted rounded-full">
                <Plane className={`w-3 h-3 text-gray-500 ${isRTL ? '-scale-x-100' : ''}`} />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{t("Outbound")}</span>
              </div>
              <span className="text-sm font-semibold text-[#1967D2] dark:text-[#5e96f2]">{format(new Date(displayOutbound.date), "EEE, d MMM", { locale: currentLocale })}</span>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center pt-1.5">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-[#1967D2] dark:border-[#5e96f2] bg-white dark:bg-card"></div>
                <div className="w-px h-12 bg-gray-200 dark:bg-gray-700 my-1"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#1967D2] dark:bg-[#5e96f2]"></div>
              </div>
              
              <div className="flex-1 flex flex-col justify-between py-0.5 text-start">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">{format(new Date(displayOutbound.date), "HH:mm")}</p>
                  <p className="text-sm text-gray-500 font-medium">{displayOutbound.origin}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">{format(new Date(displayOutbound.arrDate), "HH:mm")}</p>
                  <p className="text-sm text-gray-500 font-medium">{displayOutbound.destination}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-border/60 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{displayOutbound.airlineName}</span>
              <span className="text-gray-500 flex items-center gap-1.5"><Clock className="w-4 h-4"/> 2{t('f_h')} 30{t('f_m')}</span>
            </div>
          </Card>

          {/* Selected Fare Badge (If applicable) */}
          {displayOutbound.hasFareFamilies && (
            <Card className="p-4 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 flex items-start gap-3">
               <ShieldCheck className="w-6 h-6 text-[#1967D2] dark:text-[#5e96f2] shrink-0 mt-0.5" />
               <div className="text-start">
                 <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base mb-0.5">{t(displayOutbound.fareName)} {t("Fare Selected")}</h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">{t("fare_selected_description_outbound")}</p>
               </div>
            </Card>
          )}

          {/* Return Flight Card */}
          {returnLeg && (
            <>
              <div className="flex items-center justify-center my-6">
                <span className="bg-gray-100 dark:bg-muted text-gray-500 rounded-full p-2">
                  <ArrowRightLeft className="w-4 h-4 rotate-90" />
                </span>
                <div className="h-px bg-gray-200 dark:bg-border flex-1 ml-4" />
                <div className="h-px bg-gray-200 dark:bg-border flex-1 mr-4 order-first" />
              </div>

              <Card className="p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-border bg-white dark:bg-card">
                <div className="flex justify-between items-center mb-4">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-100 dark:bg-muted rounded-full">
                    <Plane className="w-3 h-3 text-gray-500 rotate-180" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{t("Return")}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#1967D2] dark:text-[#5e96f2]">{format(new Date(returnLeg.date), "EEE, d MMM", { locale: currentLocale })}</span>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center pt-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-[#1967D2] dark:border-[#5e96f2] bg-white dark:bg-card"></div>
                    <div className="w-px h-12 bg-gray-200 dark:bg-gray-700 my-1"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1967D2] dark:bg-[#5e96f2]"></div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between py-0.5 text-start">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">{format(new Date(returnLeg.date), "HH:mm")}</p>
                      <p className="text-sm text-gray-500 font-medium">{returnLeg.origin}</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">{format(new Date(returnLeg.arrDate), "HH:mm")}</p>
                      <p className="text-sm text-gray-500 font-medium">{returnLeg.destination}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-border/60 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{returnLeg.airlineName}</span>
                  <span className="text-gray-500 flex items-center gap-1.5"><Clock className="w-4 h-4"/> 2{t('f_h')} 30{t('f_m')}</span>
                </div>
              </Card>

              {returnLeg.hasFareFamilies && (
                <Card className="p-4 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 flex items-start gap-3">
                   <ShieldCheck className="w-6 h-6 text-[#1967D2] dark:text-[#5e96f2] shrink-0 mt-0.5" />
                   <div className="text-start">
                     <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base mb-0.5">{t(returnLeg.fareName)} {t("Fare Selected")}</h3>
                     <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">{t("fare_selected_description_return")}</p>
                   </div>
                </Card>
              )}
            </>
          )}

      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-card/80 backdrop-blur-md border-t border-gray-100 dark:border-border z-30">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-end mb-3 px-2">
            <div className="text-start">
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-0.5">
                {t('total_for_passengers', { count: totalPassengers })}
              </p>
              <p className="text-xs text-gray-400">{t("Includes taxes and fees")}</p>
            </div>
            <p className="text-2xl font-extrabold text-[#1967D2] dark:text-[#5e96f2]">{formatPrice(totalPrice)}</p>
          </div>
          <button 
            className="w-full bg-[#1967D2] text-white rounded-xl py-4 font-bold text-lg hover:bg-[#1557B0] active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(25,103,210,0.3)]"
          >
            {t("Continue to Checkout")}
          </button>
        </div>
      </div>
    </div>
  );
}
