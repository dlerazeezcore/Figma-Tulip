import React, { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { enUS, ar, es, fr } from 'date-fns/locale';

const locales: Record<string, any> = { en: enUS, ar, es, fr, ku: ar }; // Kurdish (Sorani) uses Arabic script, common to use ar if specific ku not available in date-fns

export function DateSelector({
  open,
  onOpenChange,
  tripType,
  range,
  onChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripType: import("../../types/flights").TripType;
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  const { t, i18n: i18nInstance } = useTranslation();
  const [localRange, setLocalRange] = useState<DateRange | undefined>(range);

  const currentLocale = locales[i18nInstance.language] || locales.en;

  const handleApply = () => {
    onChange(localRange);
    onOpenChange(false);
  };

  const getHeaderTitle = () => {
    if (tripType === "oneway") return t("Select Departure");
    if (!localRange?.from && !localRange?.to) return t("Select Departure");
    if (localRange?.from && !localRange?.to) return t("Select Return Date");
    return t("Selected Dates");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 h-[85dvh] w-full max-w-md mx-auto rounded-t-2xl sm:rounded-2xl mt-auto overflow-hidden flex flex-col [&>button]:hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-gray-100 dark:border-border flex justify-between items-center sticky top-0 z-10 bg-white dark:bg-card">
          <DialogTitle className="text-lg font-semibold m-0">{getHeaderTitle()}</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-muted">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex justify-center">
          <DayPicker
            mode={tripType === "roundtrip" ? "range" : "single"}
            locale={currentLocale}
            dir={document.documentElement.dir}
            // @ts-ignore - mismatch in expected types based on mode, but works in practice
            selected={tripType === "roundtrip" ? localRange : localRange?.from}
            // @ts-ignore
            onSelect={(selected) => {
              if (tripType === "oneway") {
                setLocalRange({ from: selected as Date, to: undefined });
              } else {
                setLocalRange(selected as DateRange);
              }
            }}
            disabled={{ before: new Date() }}
            numberOfMonths={1}
            className="font-sans"
            modifiersStyles={{
              selected: { backgroundColor: '#1967D2', color: 'white' },
              range_middle: { backgroundColor: 'rgba(25, 103, 210, 0.1)', color: '#1967D2' }
            }}
          />
        </div>

        <div className="p-4 bg-white dark:bg-card border-t border-gray-100 dark:border-border">
          <button 
            disabled={tripType === "roundtrip" && (!localRange?.from || !localRange?.to)}
            onClick={handleApply} 
            className="w-full bg-[#1967D2] text-white rounded-xl py-3.5 font-semibold text-base hover:bg-[#1557B0] transition-colors disabled:opacity-50 disabled:bg-gray-400"
          >
            {t("Confirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
