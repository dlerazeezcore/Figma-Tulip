import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import type { CabinClass } from "../../types/flights";

export function CabinSelector({
  open,
  onOpenChange,
  cabin,
  onChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cabin: CabinClass;
  onChange: (cabin: CabinClass) => void;
}) {
  const { t } = useTranslation();
  const options: CabinClass[] = ["Economy", "Business"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 h-[280px] w-full max-w-md mx-auto rounded-t-2xl sm:rounded-2xl mt-auto overflow-hidden flex flex-col [&>button]:hidden bg-white dark:bg-card">
        <div className="p-4 border-b border-gray-100 dark:border-border flex justify-between items-center bg-white dark:bg-card">
          <DialogTitle className="text-lg font-semibold m-0">{t("Cabin Class")}</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-muted">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option);
                onOpenChange(false);
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border-2 ${
                cabin === option
                  ? "border-[#1967D2] bg-blue-50/50 dark:border-[#5e96f2] dark:bg-blue-900/10"
                  : "border-transparent hover:bg-gray-50 dark:hover:bg-muted"
              }`}
            >
              <span className={`text-base font-medium ${cabin === option ? "text-[#1967D2] dark:text-[#5e96f2]" : "text-gray-900 dark:text-gray-100"}`}>
                {t(option)}
              </span>
              {cabin === option && (
                <Check className="w-5 h-5 text-[#1967D2] dark:text-[#5e96f2]" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
