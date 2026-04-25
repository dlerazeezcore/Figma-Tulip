import { ArrowLeft, Globe, Database, QrCode, Power, Loader2, ChevronRight, ChevronLeft, Calendar } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { CountryFlag } from "../components/ui/country-flag";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Progress } from "../components/ui/progress";
import { useNavigate } from "react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { buildQrImageUrl, type MyEsimItem, useMyEsimsPageModel } from "../wiring/my-esims-page-service";

function formatNumber(value: number): string {
  const rounded = Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatDataLabelFromMb(valueMb: number): string {
  const mb = Math.max(0, Number(valueMb || 0));
  if (mb >= 1024) {
    return `${formatNumber(mb / 1024)}GB`;
  }

  if (mb >= 10) {
    return `${Math.round(mb)}MB`;
  }

  return `${formatNumber(mb)}MB`;
}

export function MyEsims() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isRTL = document.documentElement.dir === 'rtl';
  const {
    esims,
    activeEsims,
    inactiveEsims,
    expiredEsims,
    selectedTab,
    setSelectedTab,
    loading,
    busyEsimId,
    refresh,
    handleActivate,
    handleTopUp,
    selectedQrEsim,
    setSelectedQrEsim,
  } = useMyEsimsPageModel();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCount = activeEsims.length;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY && containerRef.current && containerRef.current.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;
      if (distance > 0) {
        setPullDistance(Math.min(distance, 120));
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 80) {
      setIsRefreshing(true);
      void refresh(true)
        .catch(() => {
          toast.error(t("Could not refresh eSIMs right now."));
        })
        .finally(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        });
    } else {
      setPullDistance(0);
    }
    setStartY(0);
  };

  const handleOpenQr = (esim: MyEsimItem) => {
    if (!esim.canShowQr || !esim.qrPayload) {
      toast.error(t("QR is not available for this eSIM."));
      return;
    }

    const qrUrl = buildQrImageUrl(esim.qrPayload);
    if (!qrUrl) {
      toast.error(t("QR is not available for this eSIM."));
      return;
    }
    setSelectedQrEsim(esim);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-gradient-to-r from-green-100 to-green-200 text-green-900 border-0">
            {t("Active")}
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 border-0">
            {t("Inactive")}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 border-0">
            {t("Pending")}
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-gradient-to-r from-red-100 to-red-200 text-red-900 border-0">
            {t("Expired")}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getDataPercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return (used / total) * 100;
  };

  const getRemainingDaysLabel = (esim: MyEsimItem) => {
    if (!esim.activatedDate) {
      return t("Starts after activation");
    }
    if (esim.hasDaysLeft) {
      return t("{{count}} days left", { count: esim.daysLeft });
    }
    return t("Activated");
  };

  const selectedQrUrl = selectedQrEsim ? buildQrImageUrl(selectedQrEsim.qrPayload) : "";

  return (
    <div
      ref={containerRef}
      className="min-h-full bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-background dark:to-background pb-6 overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-300"
          style={{
            transform: `translateY(${Math.max(0, isRefreshing ? 60 : pullDistance * 0.5)}px)`,
            opacity: isRefreshing || pullDistance > 20 ? 1 : 0,
          }}
        >
          <div className="bg-white dark:bg-card shadow-lg shadow-black/5 rounded-full px-5 py-2.5 flex items-center gap-2.5 border border-black/5 dark:border-white/10 mt-[env(safe-area-inset-top)]">
            <Loader2
              className={`w-5 h-5 text-[#1967D2] ${isRefreshing ? "animate-spin" : ""}`}
              style={{ transform: !isRefreshing ? `rotate(${pullDistance * 4}deg)` : undefined }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isRefreshing ? t("Refreshing...") : pullDistance > 80 ? t("Release to refresh") : t("Pull to refresh")}
            </span>
          </div>
        </div>
      )}

      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-[calc(max(env(safe-area-inset-top),16px)+1rem)] pb-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 text-start">
          <button
            onClick={() => navigate("/bookings")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm"
          >
            {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {t("Back to Bookings")}
          </button>
          <h1 className="text-2xl mb-2 font-bold">{t("My eSIMs")}</h1>
          <div className="flex items-center gap-2 text-sm text-white/90">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span>{t('active_count_label', { count: activeCount })}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-4">
        {esims.length > 0 && (
          <div className="flex bg-gray-200/50 dark:bg-card p-1 rounded-xl mb-2 overflow-x-auto select-none no-scrollbar">
            {[
              { id: "active", label: t("Active"), count: activeEsims.length },
              { id: "inactive", label: t("Inactive"), count: inactiveEsims.length },
              { id: "expired", label: t("History"), count: expiredEsims.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex-1 min-w-[80px] text-center text-sm font-medium py-2 px-3 rounded-lg transition-all ${
                  selectedTab === tab.id
                    ? "bg-white dark:bg-muted text-[#1967D2] shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
                {tab.count > 0 && <span className="ml-1.5 opacity-60">({tab.count})</span>}
              </button>
            ))}
          </div>
        )}

        {loading && esims.length === 0 ? (
          <Card className="p-8 text-center text-gray-500 border-0 shadow-md">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#1967D2]" />
            {t("Loading your eSIMs...")}
          </Card>
        ) : esims.length === 0 ? (
          <Card className="p-8 text-center text-gray-500 border-0 shadow-md">
            {t("No eSIMs found yet.")}
          </Card>
        ) : (
          (selectedTab === "active" ? activeEsims : selectedTab === "inactive" ? inactiveEsims : expiredEsims).map((esim) => {
            const showTopUp = esim.canTopUp;
            const isBusy = busyEsimId === esim.id;
            const activateLabel = !esim.canActivate ? "Activated" : "Activate";

            return (
              <Card
                key={esim.id}
                className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    esim.status === "active"
                      ? "bg-gradient-to-r from-green-400 to-green-500"
                      : esim.status === "inactive" || esim.status === "pending"
                      ? "bg-gradient-to-r from-gray-400 to-gray-500"
                      : "bg-gradient-to-r from-red-400 to-red-500"
                  }`}
                ></div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 text-start">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 flex items-center justify-center shadow-sm">
                        <CountryFlag
                          code={esim.countryCode}
                          emoji={esim.flag}
                          className="h-9 w-12 rounded-sm object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-foreground mb-1">{esim.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-muted-foreground">
                          <Globe className="w-3.5 h-3.5" />
                          <span>{esim.country}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-end">
                      {getStatusBadge(esim.status)}
                      {showTopUp && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 px-3 text-[11px] rounded-full font-semibold shadow-sm bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/50"
                          disabled={!esim.canTopUp || isBusy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleTopUp(esim);
                          }}
                        >
                          {t("Top up")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {esim.dataTotal > 0 && (
                    <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-blue-50/50 dark:from-muted/20 dark:to-blue-900/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-primary" />
                          <span className="text-xs font-medium text-gray-700 dark:text-foreground">{t("Data Usage")}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-foreground">
                          {formatDataLabelFromMb(esim.dataRemaining)} / {formatDataLabelFromMb(esim.dataTotal)}
                        </span>
                      </div>
                      <Progress
                        value={getDataPercentage(esim.dataUsed, esim.dataTotal)}
                        className="h-2 mb-2"
                      />
                      <p className="text-xs text-gray-600 dark:text-muted-foreground text-start">
                        {t('data_used_of_remaining', { used: formatDataLabelFromMb(esim.dataUsed), remaining: formatDataLabelFromMb(esim.dataRemaining) })}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-1 mb-4">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-muted-foreground">
                      {getRemainingDaysLabel(esim)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 text-xs rounded-xl border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent"
                      disabled={!esim.canShowQr}
                      onClick={() => handleOpenQr(esim)}
                    >
                      <QrCode className="w-4 h-4 me-1.5" />
                      {t("View QR")}
                    </Button>
                    <Button
                      className="h-10 text-xs rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400"
                      disabled={!esim.canActivate || isBusy}
                      onClick={() => void handleActivate(esim)}
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4 me-1.5" />
                      )}
                      {isBusy ? t("Activating...") : t(activateLabel)}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
      <Dialog open={Boolean(selectedQrEsim)} onOpenChange={(open) => (!open ? setSelectedQrEsim(null) : undefined)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>{t("eSIM QR")}</DialogTitle>
            <DialogDescription>
              {t("Scan this QR code from your device eSIM settings to install.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center rounded-xl bg-white p-4">
            {selectedQrUrl ? (
              <img src={selectedQrUrl} alt="eSIM QR Code" className="h-64 w-64 rounded-md border border-gray-200" />
            ) : (
              <p className="text-sm text-gray-500">{t("QR is not available for this eSIM.")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
