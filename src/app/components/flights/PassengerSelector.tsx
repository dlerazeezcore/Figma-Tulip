import React, { useState } from "react";
import { User, X, Plus, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import type { PassengerCounts } from "../../types/flights";

export function PassengerSelector({
  open,
  onOpenChange,
  counts,
  onChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: PassengerCounts;
  onChange: (counts: PassengerCounts) => void;
}) {
  const { t } = useTranslation();
  const [localCounts, setLocalCounts] = useState(counts);

  const updateCount = (type: keyof PassengerCounts, delta: number) => {
    setLocalCounts(prev => {
      const next = { ...prev };
      next[type] = Math.max(type === "adults" ? 1 : 0, prev[type] + delta);
      
      // Validation rule: infants cannot exceed adults
      if (type === "adults" && next.infants > next.adults) {
        next.infants = next.adults;
      }
      if (type === "infants" && next.infants > next.adults) {
        next.infants = next.adults; // Correct if manually bypassing
      }
      return next;
    });
  };

  const totalPassengers = localCounts.adults + localCounts.children + localCounts.infants;

  const handleApply = () => {
    onChange(localCounts);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 h-[400px] w-full max-w-md mx-auto rounded-t-2xl sm:rounded-2xl mt-auto overflow-hidden flex flex-col [&>button]:hidden">
        <div className="p-4 border-b border-gray-100 dark:border-border flex justify-between items-center bg-white dark:bg-card">
          <DialogTitle className="text-lg font-semibold m-0">{t("Passengers")}</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-muted">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <StepperRow 
            title={t("Adults")} 
            sub={t("12+ years")} 
            value={localCounts.adults} 
            onDecrease={() => updateCount("adults", -1)}
            onIncrease={() => updateCount("adults", 1)}
            decreaseDisabled={localCounts.adults <= 1}
            increaseDisabled={totalPassengers >= 9}
          />
          <StepperRow 
            title={t("Children")} 
            sub={t("2-11 years")} 
            value={localCounts.children} 
            onDecrease={() => updateCount("children", -1)}
            onIncrease={() => updateCount("children", 1)}
            decreaseDisabled={localCounts.children <= 0}
            increaseDisabled={totalPassengers >= 9}
          />
          <StepperRow 
            title={t("Infants")} 
            sub={t("Under 2, on lap")} 
            value={localCounts.infants} 
            onDecrease={() => updateCount("infants", -1)}
            onIncrease={() => updateCount("infants", 1)}
            decreaseDisabled={localCounts.infants <= 0}
            increaseDisabled={localCounts.infants >= localCounts.adults || totalPassengers >= 9}
          />
        </div>

        <div className="p-4 bg-white dark:bg-card border-t border-gray-100 dark:border-border">
          <button onClick={handleApply} className="w-full bg-[#1967D2] text-white rounded-xl py-3.5 font-semibold text-base hover:bg-[#1557B0] transition-colors">
            {t("Confirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepperRow({ title, sub, value, onDecrease, onIncrease, decreaseDisabled, increaseDisabled }: any) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-sm text-gray-500">{sub}</p>
      </div>
      <div className="flex items-center gap-4">
        <button 
          disabled={decreaseDisabled}
          onClick={onDecrease}
          className="w-10 h-10 rounded-full border border-gray-200 dark:border-border flex items-center justify-center disabled:opacity-30 disabled:bg-gray-50 dark:disabled:bg-muted active:scale-95 transition-transform"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-4 text-center font-semibold">{value}</span>
        <button 
          disabled={increaseDisabled}
          onClick={onIncrease}
          className="w-10 h-10 rounded-full border border-gray-200 dark:border-border flex items-center justify-center disabled:opacity-30 disabled:bg-gray-50 dark:disabled:bg-muted active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
