import { ArrowLeft, Globe, Calendar, Database, QrCode, Zap, Power, Loader2 } from "lucide-react";
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

function formatDate(value: string): string {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MyEsims() {
  const navigate = useNavigate();
  const {
    esims,
    activeEsims,
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
          toast.error("Could not refresh eSIMs right now.");
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
      toast.error("QR is not available for this eSIM.");
      return;
    }

    const qrUrl = buildQrImageUrl(esim.qrPayload);
    if (!qrUrl) {
      toast.error("QR is not available for this eSIM.");
      return;
    }
    setSelectedQrEsim(esim);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-gradient-to-r from-green-100 to-green-200 text-green-900 border-0">
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 border-0">
            Inactive
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 border-0">
            Pending
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-gradient-to-r from-red-100 to-red-200 text-red-900 border-0">
            Expired
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
          className="flex items-center justify-center py-4 transition-all"
          style={{
            opacity: Math.min(pullDistance / 80, 1),
            transform: `translateY(${Math.min(pullDistance - 80, 0)}px)`,
          }}
        >
          {isRefreshing ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <div className="text-sm text-gray-600">
              {pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}
            </div>
          )}
        </div>
      )}

      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-12 pb-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10">
          <button
            onClick={() => navigate("/bookings")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </button>
          <h1 className="text-2xl mb-2">My eSIMs</h1>
          <div className="flex items-center gap-2 text-sm text-white/90">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span>{activeCount} active</span>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-4">
        {loading && esims.length === 0 ? (
          <Card className="p-8 text-center text-gray-500 border-0 shadow-md">
            Loading your eSIMs...
          </Card>
        ) : esims.length === 0 ? (
          <Card className="p-8 text-center text-gray-500 border-0 shadow-md">
            No eSIMs found yet.
          </Card>
        ) : (
          esims.map((esim) => {
            const showTopUp = esim.hasTopUp;
            const isBusy = busyEsimId === esim.id;
            const activateLabel = esim.canActivate ? "Activate" : "Activated";

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
                    <div className="flex items-center gap-3 flex-1">
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
                    {getStatusBadge(esim.status)}
                  </div>

                  {esim.dataTotal > 0 && (
                    <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-blue-50/50 dark:from-muted/20 dark:to-blue-900/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-primary" />
                          <span className="text-xs font-medium text-gray-700 dark:text-foreground">Data Usage</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-foreground">
                          {formatDataLabelFromMb(esim.dataRemaining)} / {formatDataLabelFromMb(esim.dataTotal)}
                        </span>
                      </div>
                      <Progress
                        value={getDataPercentage(esim.dataUsed, esim.dataTotal)}
                        className="h-2 mb-2"
                      />
                      <p className="text-xs text-gray-600 dark:text-muted-foreground">
                        {formatDataLabelFromMb(esim.dataUsed)} used • {formatDataLabelFromMb(esim.dataRemaining)} remaining
                      </p>
                    </div>
                  )}

                  {esim.dataTotal === 0 && esim.status !== "expired" && (
                    <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/40">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-foreground">Unlimited Data</p>
                          <p className="text-xs text-gray-600 dark:text-muted-foreground">Use as much as you need</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-card border border-gray-100 dark:border-border mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-600 dark:text-muted-foreground">Valid until</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-foreground">{formatDate(esim.validUntil)}</p>
                      {!esim.activatedDate ? (
                        <p className="text-xs text-gray-500 dark:text-muted-foreground/60">Not activated yet</p>
                      ) : esim.status === "expired" || (esim.hasDaysLeft && esim.daysLeft <= 0) ? (
                        <p className="text-xs text-red-600 dark:text-red-400">Expired/Inactive</p>
                      ) : esim.hasDaysLeft && esim.daysLeft > 0 ? (
                        <p className="text-xs text-gray-500 dark:text-muted-foreground/60">{esim.daysLeft} days left</p>
                      ) : (
                        <p className="text-xs text-gray-500">-</p>
                      )}
                    </div>
                  </div>

                  <div className={`grid gap-2 ${showTopUp ? "grid-cols-3" : "grid-cols-2"}`}>
                    <Button
                      variant="outline"
                      className="h-10 text-xs rounded-xl border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent"
                      disabled={!esim.canShowQr}
                      onClick={() => handleOpenQr(esim)}
                    >
                      <QrCode className="w-4 h-4 mr-1.5" />
                      View QR
                    </Button>
                    <Button
                      className="h-10 text-xs rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400"
                      disabled={!esim.canActivate || isBusy}
                      onClick={() => void handleActivate(esim)}
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4 mr-1.5" />
                      )}
                      {isBusy ? "Activating..." : activateLabel}
                    </Button>
                    {showTopUp && (
                      <Button
                        variant="outline"
                        className="h-10 text-xs rounded-xl border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent"
                        disabled={!esim.canTopUp || isBusy}
                        onClick={() => void handleTopUp(esim)}
                      >
                        Top up
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
      <Dialog open={Boolean(selectedQrEsim)} onOpenChange={(open) => (!open ? setSelectedQrEsim(null) : undefined)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>eSIM QR</DialogTitle>
            <DialogDescription>
              Scan this QR code from your device eSIM settings to install.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center rounded-xl bg-white p-4">
            {selectedQrUrl ? (
              <img src={selectedQrUrl} alt="eSIM QR Code" className="h-64 w-64 rounded-md border border-gray-200" />
            ) : (
              <p className="text-sm text-gray-500">QR is not available for this eSIM.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
