import React, { useState } from "react";
import { useNavigate } from "react-router";
import { PlaneTakeoff, PlaneLanding, Calendar, User, ArrowRightLeft, ArrowLeft, Armchair, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/card";
import { AirportSelector } from "../../components/flights/AirportSelector";
import { PassengerSelector, type PassengerCounts } from "../../components/flights/PassengerSelector";
import { CabinSelector, type CabinClass } from "../../components/flights/CabinSelector";
import { DateSelector } from "../../components/flights/DateSelector";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import type { Airport, TripType } from "../../types/flights";

type ActiveSheet = "none" | "origin" | "destination" | "dates" | "passengers" | "cabin";

export function FlightSearchFlow() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tripType, setTripType] = useState<TripType>("oneway");
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>("none");
  
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [passengers, setPassengers] = useState<PassengerCounts>({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState<CabinClass>("Economy");

  const totalPassengers = passengers.adults + passengers.children + passengers.infants;

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSearch = () => {
    navigate("/flights/results", {
      state: {
        tripType,
        dateRange,
        passengers,
        cabin,
        origin,
        destination,
        phase: "outbound"
      }
    });
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background pb-20">
      {/* Header - Consistent with brand gradient */}
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 overflow-hidden texture-noise">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-56 h-56 bg-white/3 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

        <div className="relative z-10 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 -ms-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-all text-white shadow-sm border border-transparent hover:border-white/20 active:scale-95">
            {document.documentElement.dir === 'rtl' ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Search Flights")}</h1>
        </div>
      </header>

      <main className="p-4 mt-2">
        {/* Trip Type Toggle */}
        <div className="flex bg-gray-100 dark:bg-muted p-1 rounded-xl mb-6 shadow-inner relative max-w-[240px] mx-auto">
          {/* Animated background pill */}
          <div 
            className="absolute inset-y-1 w-[calc(50%-4px)] bg-white dark:bg-card rounded-lg shadow-sm transition-all duration-300 ease-out"
            style={{ 
              left: document.documentElement.dir === 'rtl' ? 'auto' : '4px',
              right: document.documentElement.dir === 'rtl' ? '4px' : 'auto',
              transform: tripType === "roundtrip" 
                ? (document.documentElement.dir === 'rtl' ? "translateX(-100%)" : "translateX(100%)") 
                : "translateX(0)" 
            }}
          />
          <button 
            className={`flex-1 relative z-10 py-1.5 text-sm font-medium transition-colors ${tripType === "oneway" ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
            onClick={() => setTripType("oneway")}
          >
            {t("One Way")}
          </button>
          <button 
            className={`flex-1 relative z-10 py-1.5 text-sm font-medium transition-colors ${tripType === "roundtrip" ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
            onClick={() => setTripType("roundtrip")}
          >
            {t("Round Trip")}
          </button>
        </div>

        {/* Main Search Container */}
        <Card className="p-1 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-border/50">
          
          {/* Routing section */}
          <div className="relative px-4 pt-4 pb-3 border-b border-gray-100 dark:border-border">
            {/* Origin */}
            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveSheet("origin")}>
              <PlaneTakeoff className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              <div>
                <p className="text-xs text-gray-500 font-medium mb-0.5">{t("From")}</p>
                {origin ? (
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{origin.city} <span className="text-gray-400 font-medium text-sm ms-1">{origin.code}</span></p>
                ) : (
                  <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">{t("Select city or airport")}</p>
                )}
              </div>
            </div>

            {/* Swap Button */}
            <div className={`absolute ${document.documentElement.dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 z-10`}>
              <button onClick={handleSwap} className="bg-white dark:bg-card border border-gray-200 dark:border-border p-2 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95 text-primary">
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Divider Line */}
            <div className="ms-9 border-s-2 border-dashed border-gray-200 dark:border-border h-4 my-1" />

            {/* Destination */}
            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveSheet("destination")}>
              <PlaneLanding className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              <div>
                <p className="text-xs text-gray-500 font-medium mb-0.5">{t("To")}</p>
                {destination ? (
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{destination.city} <span className="text-gray-400 font-medium text-sm ms-1">{destination.code}</span></p>
                ) : (
                  <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">{t("Select destination")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Dates section */}
          <div className="flex border-b border-gray-100 dark:border-border">
            <div 
              className={`flex-1 px-4 py-3 flex items-center gap-4 cursor-pointer group ${tripType === "roundtrip" ? "border-e border-gray-100 dark:border-border" : ""}`}
              onClick={() => setActiveSheet("dates")}
            >
              <Calendar className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium mb-0.5">{t("Departure")}</p>
                <p className={`text-base font-semibold truncate ${dateRange?.from ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>
                  {dateRange?.from ? format(dateRange.from, "EEE, d MMM") : t("Select date")}
                </p>
              </div>
            </div>

            {tripType === "roundtrip" && (
              <div 
                className="flex-1 px-4 py-3 flex items-center gap-4 cursor-pointer group"
                onClick={() => setActiveSheet("dates")}
              >
                <div className="min-w-0 ps-1">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">{t("Return")}</p>
                  <p className={`text-base font-semibold truncate ${dateRange?.to ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>
                    {dateRange?.to ? format(dateRange.to, "EEE, d MMM") : t("Add date")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Passengers & Cabin section */}
          <div className="flex">
            <div 
              className="flex-1 px-4 py-3 border-e border-gray-100 dark:border-border flex items-center gap-3 cursor-pointer group"
              onClick={() => setActiveSheet("passengers")}
            >
              <User className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors shrink-0" />
              <div className="min-w-0 ps-1">
                <p className="text-xs text-gray-500 font-medium mb-0.5">{t("Passengers")}</p>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {totalPassengers}
                </p>
              </div>
            </div>

            <div 
              className="flex-1 px-4 py-3 flex items-center gap-3 cursor-pointer group"
              onClick={() => setActiveSheet("cabin")}
            >
              <Armchair className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors shrink-0" />
              <div className="min-w-0 ps-1">
                <p className="text-xs text-gray-500 font-medium mb-0.5">{t("Cabin")}</p>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {t(cabin)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Search Action */}
        <div className="mt-8">
          <button 
            disabled={!origin || !destination || !dateRange?.from || (tripType === "roundtrip" && !dateRange?.to)}
            onClick={handleSearch}
            className="w-full bg-[#1967D2] text-white rounded-xl py-3.5 font-semibold text-lg shadow-lg shadow-blue-500/30 hover:bg-[#1557B0] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {t("Search Flights")}
          </button>
        </div>
      </main>

      {/* Sheets / Modals */}
      <AirportSelector 
        open={activeSheet === "origin" || activeSheet === "destination"} 
        onOpenChange={(open) => !open && setActiveSheet("none")}
        context={activeSheet === "origin" ? "origin" : "destination"}
        onSelect={(airport) => {
          if (activeSheet === "origin") setOrigin(airport);
          if (activeSheet === "destination") setDestination(airport);
        }}
      />

      <PassengerSelector 
        open={activeSheet === "passengers"}
        onOpenChange={(open) => !open && setActiveSheet("none")}
        counts={passengers}
        onChange={setPassengers}
      />

      <DateSelector
        open={activeSheet === "dates"}
        onOpenChange={(open) => !open && setActiveSheet("none")}
        tripType={tripType}
        range={dateRange}
        onChange={setDateRange}
      />

      <CabinSelector
        open={activeSheet === "cabin"}
        onOpenChange={(open) => !open && setActiveSheet("none")}
        cabin={cabin}
        onChange={setCabin}
      />
    </div>
  );
}
