import { ChevronLeft, ChevronRight, Globe, Search, X, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthModal } from "../components/auth/AuthModal";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { CountryFlag } from "../components/ui/country-flag";
import { Input } from "../components/ui/input";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { useCurrency } from "../utils/currency";
import {
  usePlansPageModel,
} from "../wiring/plans-page-service";

export function Plans() {
  const { t } = useTranslation();
  const { formatPrice, currency: selectedCurrency } = useCurrency();
  const isRTL = document.documentElement.dir === 'rtl';
  const {
    searchQuery,
    selectedDestination,
    selectedBundleId,
    isLoadingDestinations,
    isLoadingBundles,
    exchangeRate,
    markupPercent,
    showAuthModal,
    filteredDestinations,
    groupedBundles,
    getDestinationPreview,
    activeTab,
    popularDestinations,
    setActiveTab,
    setSearchQuery,
    setSelectedBundleId,
    setShowAuthModal,
    selectDestination,
    clearSelectedDestination,
    handleContinue,
    handleAuthSuccess,
  } = usePlansPageModel();

  // Track whether user has explicitly chosen a tab vs fresh landing (popular)
  const [explicitTab, setExplicitTab] = useState<"popular" | "countries" | "regions">("popular");
  const [countriesSheetBundle, setCountriesSheetBundle] = useState<{ countries: { name: string; code: string }[]; label: string } | null>(null);
  const [countriesSheetSearch, setCountriesSheetSearch] = useState("");

  const handleTabChange = (tab: "countries" | "regions") => {
    setExplicitTab(tab);
    setActiveTab(tab === "countries" ? "country" : "regional");
  };

  // Determine which destinations to show
  const isSearching = searchQuery.trim().length > 0;
  const destinationsToShow = isSearching
    ? filteredDestinations
    : explicitTab === "popular"
      ? popularDestinations
      : filteredDestinations;

  const sectionTitle = isSearching
    ? t("Search Results")
    : explicitTab === "popular"
      ? t("Popular Destinations")
      : explicitTab === "countries"
        ? t("All Countries")
        : t("All Regions");

  const sectionCount = isLoadingDestinations
    ? t("Loading...")
    : `${destinationsToShow.length} ${isSearching ? t("found") : explicitTab === "popular" ? t("destinations") : explicitTab === "countries" ? t("countries") : t("regions")}`;

  // Assign different destination images based on index
  const destinationImages = [
    "https://images.unsplash.com/photo-1642947392578-b37fbd9a4d45?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJpcyUyMGVpZmZlbCUyMHRvd2VyJTIwc3Vuc2V0fGVufDF8fHx8MTc3NTMyNzYwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1726796827237-abb307d99515?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkdWJhaSUyMHNreWxpbmUlMjBjaXR5c2NhcGV8ZW58MXx8fHwxNzc1NDExMDg4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1641558996066-fcf78962c30a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0b2t5byUyMGphcGFuJTIwc3RyZWV0fGVufDF8fHx8MTc3NTM3NTE4N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1600682111749-2456071bf366?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsb25kd24lMjBiaWclMjBiZW4lMjBsYW5kbWFya3xlbnwxfHx8fDE3NzUzODE1MDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1707779734349-ef2bba17dfdb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwY2l0eSUyMG1hbmhhdHRhbnxlbnwxfHx8fDE3NzUzNzA0OTh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    "https://images.unsplash.com/photo-1610023926499-571d3b203226?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3NTQxOTQ3Mnww&ixlib=rb-4.1.0&q=80&w=1080"
  ];

  // Collect all unique included countries from bundles for regional destinations
  const allIncludedCountries = useMemo(() => {
    if (!selectedDestination || selectedDestination.type !== "regional") return [];
    const seen = new Set<string>();
    const result: { name: string; code: string }[] = [];
    groupedBundles.forEach((group) =>
      group.offers.forEach((b) =>
        b.includedCountries.forEach((c) => {
          if (!seen.has(c.name)) {
            seen.add(c.name);
            result.push(c);
          }
        })
      )
    );
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedDestination, groupedBundles]);

  if (selectedDestination) {
    return (
      <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background pb-24">
        {/* Header - Consistent with brand gradient */}
        <div className="relative px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-8 bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white overflow-hidden texture-noise">
          {/* Enhanced Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-56 h-56 bg-white/3 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

          <div className="relative z-10 text-start">
            <button onClick={clearSelectedDestination} className="mb-6 -ms-2 p-2.5 rounded-lg hover:bg-white/15 active:bg-white/20 transition-all backdrop-blur-md border border-white/20 shadow-lg hover:scale-105 active:scale-95">
              {isRTL ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
            </button>

            <h1 className="text-2xl mb-6 tracking-tight font-bold">{t("Available plans")}</h1>

            <Card className="relative overflow-hidden border-0 shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)] bg-white dark:bg-card">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent dark:from-blue-500/5 dark:via-purple-500/0"></div>
              <div className="relative flex items-center gap-3 p-4">
                <div className="w-16 h-16 rounded-xl bg-white dark:bg-muted shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center flex-shrink-0">
                  <CountryFlag
                    code={selectedDestination.code}
                    emoji={selectedDestination.flag}
                    className="h-10 w-14 rounded-sm object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-0.5 tracking-tight dark:text-foreground">{selectedDestination.name}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{t("Choose your data plan")}</p>
                  {selectedDestination.type === "regional" && allIncludedCountries.length > 0 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-400 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 hover:scale-105 active:scale-95 transition-all shadow-sm border border-blue-200/50 dark:border-blue-800/40"
                      onClick={() => {
                        setCountriesSheetBundle({ countries: allIncludedCountries, label: selectedDestination.name });
                        setCountriesSheetSearch("");
                      }}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {t('countries_included', { count: allIncludedCountries.length })}
                      {isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="px-6 space-y-6 mt-2">
          {isLoadingBundles ? (
            <Card className="p-8 text-center bg-white dark:bg-card shadow-sm border border-gray-100 dark:border-border">
              <p className="text-muted-foreground">{t("Loading plans...")}</p>
            </Card>
          ) : groupedBundles.length === 0 ? (
            <Card className="p-8 text-center bg-white dark:bg-card shadow-sm border border-gray-100 dark:border-border">
              <p className="text-muted-foreground">{t("No offers found")}</p>
            </Card>
          ) : (
            <RadioGroup value={selectedBundleId} onValueChange={setSelectedBundleId}>
              {groupedBundles.map((group) => (
                <div key={`validity-${group.validity}`} className="space-y-3 mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-0.5 w-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-foreground">
                      {t('validity_days', { count: group.validity })}
                    </h3>
                  </div>
                  {group.offers.map((bundle) => {
                    const isSelected = selectedBundleId === bundle.id;
                    return (
                      <label
                        key={bundle.id}
                        htmlFor={`plan-${bundle.id}`}
                        className={`
                          relative flex items-center gap-4 p-5 bg-white dark:bg-card rounded-2xl cursor-pointer 
                          transition-all duration-200 shadow-sm overflow-hidden text-start
                          ${isSelected 
                            ? 'border-2 border-primary shadow-xl ring-4 ring-primary/10' 
                            : 'border-2 border-gray-100 dark:border-border hover:border-gray-200 dark:hover:border-accent hover:shadow-lg hover:scale-[1.01]'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-20 h-20 bg-gradient-to-br from-primary/20 to-purple-500/20 ${isRTL ? 'rounded-br-full' : 'rounded-bl-full'}`}></div>
                        )}
                        <RadioGroupItem value={bundle.id} id={`plan-${bundle.id}`} className="relative z-10 flex-shrink-0" />
                        <div className="flex-1 min-w-0 relative z-10">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-lg font-semibold mb-1.5 text-gray-900 dark:text-foreground">{bundle.dataLabel}</div>
                              {bundle.isPerDay && (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 dark:text-blue-200 text-blue-900">
                                  {t("Daily allowance")}
                                </span>
                              )}
                            </div>
                            <div className="text-end flex-shrink-0">
                              <div className="text-xl font-bold text-gray-900 dark:text-foreground whitespace-nowrap mb-0.5">
                                {formatPrice(bundle.price)}
                              </div>
                              {isSelected && (
                                <span className="text-xs text-primary font-medium">{t("Selected")}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}</div>
              ))}
            </RadioGroup>
          )}
        </div>

        {/* 
          ============================================
          REDESIGNED STICKY CTA FOOTER
          ============================================
          Visual update only — no functionality change.
          
          DESIGN SPECS:
          - Container: SOLID white background (100% opaque)
          - Border: Subtle top border for definition
          - Button Enabled: Vibrant gradient with strong shadow
          - Button Disabled: Readable gray (not washed out)
          - Safe area: iOS/Android notch-aware padding
          - Elevation: Strong depth to stand out over content
          - NO TRANSPARENCY: Content behind will not show through
          ============================================
        */}
        <div className="fixed bottom-20 left-0 right-0 bg-white dark:bg-card border-t border-gray-200 dark:border-border shadow-2xl pointer-events-none z-40 backdrop-blur-none">
          {/* Safe area spacer for iOS/Android bottom insets */}
          <div className="px-6 pt-4 pb-6 bg-white dark:bg-card">
            <Button
              className={`
                w-full h-14 rounded-2xl text-base font-semibold
                transition-all duration-200 pointer-events-auto
                shadow-lg hover:shadow-xl active:scale-[0.98]
                ${selectedBundleId 
                  ? 'bg-gradient-to-r from-[#1967D2] to-[#1557B0] hover:from-[#1557B0] hover:to-[#114A99] text-white shadow-primary/30 hover:shadow-primary/40' 
                  : 'bg-gray-200 dark:bg-muted text-gray-500 dark:text-muted-foreground cursor-not-allowed shadow-gray-200/50 dark:shadow-none'
                }
              `}
              disabled={!selectedBundleId}
              onClick={handleContinue}
            >
              {t("Continue to Checkout")}
            </Button>
          </div>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          initialMode="signup"
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* Included Countries Bottom Sheet */}
        {countriesSheetBundle && (
          <IncludedCountriesSheet
            countries={countriesSheetBundle.countries}
            label={countriesSheetBundle.label}
            search={countriesSheetSearch}
            onSearchChange={setCountriesSheetSearch}
            onClose={() => setCountriesSheetBundle(null)}
          />
        )}
      </div>
    );
  }

  // --- DESTINATION LIST VIEW ---
  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background pb-6">
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6 overflow-hidden texture-noise text-start">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-56 h-56 bg-white/3 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

        <div className="relative z-10">
          <h1 className="text-2xl mb-2 tracking-tight font-bold">{t("Browse eSIM Plans")}</h1>
          <p className="text-sm text-white/95 mb-6 font-medium">{t("Discover the perfect plan for your travels")}</p>

          <div className="relative">
            <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70`} />
            <Input
              type="text"
              placeholder={t("Search country name...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${isRTL ? 'pr-12' : 'pl-12'} h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-white placeholder:text-white/70 focus:bg-white/25 focus:border-white/50 shadow-lg transition-all text-start`}
            />
          </div>
        </div>
      </header>

      <section className="px-6 mt-6">
        {/* Tab Switcher */}
        <div className="flex bg-gray-100/80 dark:bg-muted/80 backdrop-blur-sm rounded-xl p-1 mb-5 shadow-inner">
          <button
            onClick={() => handleTabChange("countries")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "country" && explicitTab === "countries"
                ? "bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] scale-[1.02]"
                : "text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-accent/50"
            }`}
          >
            {t("Countries")}
          </button>
          <button
            onClick={() => handleTabChange("regions")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "regional" && explicitTab === "regions"
                ? "bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] scale-[1.02]"
                : "text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-accent/50"
            }`}
          >
            {t("Regions")}
          </button>
        </div>

        <div className="flex items-center justify-between mb-4 text-start">
          <div>
            <h2 className="text-lg mb-1 tracking-tight dark:text-foreground font-bold">{sectionTitle}</h2>
            <p className="text-xs text-muted-foreground font-medium">
              {sectionCount}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-start">
          {isLoadingDestinations ? (
            <Card className="p-8 text-center bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-border">
              <p className="text-muted-foreground font-medium">{t("Loading destinations...")}</p>
            </Card>
          ) : destinationsToShow.length === 0 ? (
            <Card className="p-8 text-center bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-border">
              <p className="text-muted-foreground font-medium">
                {isSearching ? t("No destinations found matching your search") : t("No popular destinations available")}
              </p>
            </Card>
          ) : (
            destinationsToShow.map((destination, index) => {
              const imageUrl = destinationImages[index % destinationImages.length];
              const preview = getDestinationPreview(destination);

              return (
                <button
                  key={`${destination.type}-${destination.code}`}
                  onClick={() => selectDestination(destination)}
                  className="w-full text-start group"
                >
                  <Card className="relative overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.08)] transition-all duration-300 active:scale-[0.98]">
                    {/* Background Image with enhanced rendering */}
                    <div className="absolute inset-0">
                      <img
                        src={imageUrl}
                        alt={destination.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40 group-hover:from-black/70 group-hover:via-black/50 group-hover:to-black/30 transition-all duration-300"></div>
                      {/* Subtle vignette for depth */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20"></div>
                    </div>

                    {/* Content */}
                    <div className="relative p-5 flex items-center gap-4">
                      <div className="w-16 h-12 rounded-lg overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.3)] border-2 border-white/40 flex-shrink-0 group-hover:border-white/60 transition-all">
                        <CountryFlag
                          code={destination.code}
                          emoji={destination.flag}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1 text-base tracking-tight drop-shadow-lg">{destination.name}</h3>
                        {preview.plansCount > 0 ? (
                          <p className="text-sm text-white/95 font-medium drop-shadow-md">
                            {t("From")} {formatPrice(preview.priceFrom)}
                          </p>
                        ) : (
                          <p className="text-sm text-white/95 font-medium drop-shadow-md">{t("Plans available")}</p>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:bg-white/25 group-hover:scale-110 transition-all shadow-lg">
                        <Zap className={`w-5 h-5 text-white drop-shadow-md ${isRTL ? '-scale-x-100' : ''}`} strokeWidth={2.5} />
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })
          )}
        </div>
      </section>

      <AuthModal
        isOpen={showAuthModal}
        initialMode="signup"
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

function IncludedCountriesSheet({
  countries,
  label,
  search,
  onSearchChange,
  onClose,
}: {
  countries: { name: string; code: string }[];
  label: string;
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const filtered = countries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-white dark:bg-card rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 pt-2 border-b border-gray-100 dark:border-border text-start">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">{t("Included Countries")}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 dark:text-blue-200 text-blue-700">
                  {t('countries_included', { count: countries.length })}
                </span>
                <span className="text-xs text-gray-400 dark:text-muted-foreground/60">{label}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-muted flex items-center justify-center hover:bg-gray-200 dark:hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("Search countries...")}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-50 dark:bg-muted border border-gray-200 dark:border-border text-sm text-gray-900 dark:text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 text-start"
            />
          </div>
        </div>

        {/* Country List */}
        <div className="flex-1 overflow-y-auto px-6 pb-8 text-start">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-muted flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400">{t("No countries match your search")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-border">
              {filtered.map((country, idx) => (
                <div
                  key={`${country.code || country.name}-${idx}`}
                  className="flex items-center gap-3.5 py-3 first:pt-1"
                >
                  <div className="w-9 h-6 rounded-md overflow-hidden shadow-sm border border-gray-200/60 dark:border-border flex-shrink-0 bg-gray-50 dark:bg-muted flex items-center justify-center">
                    <CountryFlag
                      code={country.code}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm text-gray-900 dark:text-foreground">{country.name}</span>
                  {country.code && (
                    <span className="text-[11px] text-gray-400 dark:text-muted-foreground/60 ms-auto font-mono">{country.code}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
