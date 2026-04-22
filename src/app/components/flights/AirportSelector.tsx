import React, { useState } from "react";
import { Search, X, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import type { Airport } from "../../types/flights";

const mockAirports = [
  { code: "EBL", city: "Erbil", name: "Erbil International Airport", country: "Iraq" },
  { code: "DUS", city: "Dusseldorf", name: "Düsseldorf Airport", country: "Germany" },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "Germany" },
  { code: "LHR", city: "London", name: "Heathrow Airport", country: "UK" },
  { code: "DXB", city: "Dubai", name: "Dubai International Airport", country: "UAE" },
  { code: "SAW", city: "Istanbul", name: "Sabiha Gökçen", country: "Turkey" },
  { code: "IST", city: "Istanbul", name: "Istanbul Airport", country: "Turkey" }
];

export function AirportSelector({ 
  open, 
  onOpenChange, 
  context, 
  onSelect 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  context: "origin" | "destination";
  onSelect: (airport: Airport) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filtered = mockAirports.filter(a => 
    a.code.toLowerCase().includes(query.toLowerCase()) || 
    a.city.toLowerCase().includes(query.toLowerCase()) ||
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 h-[90dvh] w-full max-w-md mx-auto rounded-t-2xl sm:rounded-2xl mt-auto overflow-hidden flex flex-col [&>button]:hidden">
        
        {/* Header containing the input */}
        <div className="p-4 border-b border-gray-100 dark:border-border sticky top-0 bg-white dark:bg-card z-10">
          <div className="flex justify-between items-center mb-4">
            <DialogTitle className="text-lg font-semibold m-0">
              {context === "origin" ? t("Where from?") : t("Where to?")}
            </DialogTitle>
            <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-muted">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              autoFocus
              className="w-full bg-gray-100 dark:bg-muted border-transparent focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:bg-card rounded-xl py-3 ps-10 pe-10 text-sm outline-none transition-all"
              placeholder={t("Search city or airport")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute end-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>{t('No airports found for "{{query}}"', { query })}</p>
            </div>
          ) : (
            filtered.map((airport) => (
              <button
                key={airport.code}
                onClick={() => {
                  onSelect(airport);
                  onOpenChange(false);
                  setQuery("");
                }}
                className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-muted/50 rounded-xl transition-colors text-start"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-muted flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{airport.city}</p>
                  <p className="text-xs text-gray-500 truncate">{airport.name}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-12 py-1 rounded bg-gray-100 dark:bg-muted text-sm font-bold text-gray-700 dark:text-gray-300 tracking-wider">
                    {airport.code}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
