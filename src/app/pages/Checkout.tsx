import { ChevronLeft, Crown, QrCode, X, ShoppingBag, CheckCircle, CreditCard } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { CountryFlag } from "../components/ui/country-flag";
import { Switch } from "../components/ui/switch";
import { formatIqd } from "../utils/currency";
import { useCheckoutPageModel } from "../wiring/checkout-page-service";

export function Checkout() {
  const {
    checkoutData,
    totalIqd,
    selectedPaymentMethod,
    autoTopUp,
    showPaymentModal,
    showLoyaltyModal,
    qrCodeUrl,
    paymentId,
    paymentAmountIqd,
    hasLoyaltyAccess,
    isProcessing,
    setSelectedPaymentMethod,
    setAutoTopUp,
    setShowPaymentModal,
    setShowLoyaltyModal,
    handleContinue,
    handlePayNow,
    confirmLoyaltyPurchase,
    navigateBack,
    navigateToPlans,
  } = useCheckoutPageModel();

  if (!checkoutData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-background dark:to-background flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/10 dark:from-primary/20 dark:to-blue-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <ShoppingBag className="w-10 h-10 text-primary" />
          </div>
          <p className="text-gray-500 dark:text-muted-foreground mb-4">No checkout data available</p>
          <Button onClick={navigateToPlans} className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 shadow-md">
            Go to Plans
          </Button>
        </div>
      </div>
    );
  }

  const { country, plan } = checkoutData;

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-background dark:to-background pb-24">
      <header className="relative px-6 pt-12 pb-6 bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <button onClick={navigateBack} className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl">Checkout</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-6 py-6 space-y-4">
        {/* Order Summary Card */}
        <Card className="p-6 border-0 shadow-lg overflow-hidden relative bg-white dark:bg-card">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl"></div>
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-xl dark:text-foreground">Order summary</h2>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-muted/40 dark:to-muted/40 rounded-xl mb-4 border border-blue-100 dark:border-border">
              <div className="w-14 h-14 rounded-xl bg-white dark:bg-muted shadow-md flex items-center justify-center">
                <CountryFlag
                  code={country.code}
                  emoji={country.flag}
                  className="h-8 w-11 rounded-sm object-cover"
                />
              </div>
              <span className="text-base font-medium dark:text-foreground">{country.name}</span>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted/50 rounded-lg">
                <span className="text-gray-600 dark:text-muted-foreground">Plan</span>
                <span className="text-base font-medium dark:text-foreground">{plan.data} GB</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted/50 rounded-lg">
                <span className="text-gray-600 dark:text-muted-foreground">Type</span>
                <span className="text-base font-medium dark:text-foreground">Data only</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted/50 rounded-lg">
                <span className="text-gray-600 dark:text-muted-foreground">Duration</span>
                <span className="text-base font-medium dark:text-foreground">{plan.validity} days</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xl pt-4 border-t-2 border-gray-200 dark:border-border">
              <span className="font-medium dark:text-foreground">Total</span>
              <span className="font-bold text-primary">{formatIqd(totalIqd)} IQD</span>
            </div>
          </div>
        </Card>

        {/* Auto Top-Up Card */}
        <Card className="p-5 border-0 shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-900/40 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-base font-medium mb-0.5 dark:text-foreground">Enable auto top-up</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically recharge when data runs low
                </p>
              </div>
            </div>
            <Switch checked={autoTopUp} onCheckedChange={setAutoTopUp} />
          </div>
        </Card>

        {/* Payment Method Card */}
        <Card className="p-6 border-0 shadow-lg bg-white dark:bg-card">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-xl dark:text-foreground">Payment method</h2>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setSelectedPaymentMethod("fib")}
              className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all ${
                selectedPaymentMethod === "fib"
                  ? "border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 shadow-md"
                  : "border-gray-200 dark:border-border bg-white dark:bg-muted hover:bg-gray-50 dark:hover:bg-accent hover:border-gray-300 dark:hover:border-accent"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${selectedPaymentMethod === "fib" ? "bg-yellow-400" : "bg-gray-100 dark:bg-card"} flex items-center justify-center`}>
                  <CreditCard className={`w-5 h-5 ${selectedPaymentMethod === "fib" ? "text-yellow-900" : "text-gray-600"}`} />
                </div>
                <span className="text-base font-medium dark:text-foreground">FIB Payment</span>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedPaymentMethod === "fib"
                  ? "border-yellow-400"
                  : "border-gray-300 dark:border-border"
              }`}>
                {selectedPaymentMethod === "fib" && (
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-400" />
                )}
              </div>
            </button>

            {hasLoyaltyAccess && (
              <button
                onClick={() => setSelectedPaymentMethod("loyalty")}
                className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all overflow-hidden relative ${
                  selectedPaymentMethod === "loyalty"
                    ? "border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 shadow-md"
                    : "border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30"
                }`}
              >
                {selectedPaymentMethod === "loyalty" && (
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-bl-full"></div>
                )}
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-base font-medium text-purple-900 dark:text-purple-300">Loyalty Program</div>
                    <div className="text-xs text-purple-700 dark:text-purple-400">Buy now, pay later</div>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPaymentMethod === "loyalty"
                    ? "border-purple-400"
                    : "border-purple-300 dark:border-purple-800"
                }`}>
                  {selectedPaymentMethod === "loyalty" && (
                    <div className="w-3.5 h-3.5 rounded-full bg-purple-400" />
                  )}
                </div>
              </button>
            )}
          </div>

          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-4">
              By continuing, you agree to our{" "}
              <span className="underline">terms of service</span> and{" "}
              <span className="underline">privacy policy</span>.
            </p>
            <Button
              className="w-full h-14 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white rounded-2xl font-medium shadow-lg"
              onClick={handleContinue}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Continue to Payment"}
            </Button>
          </div>
        </Card>
      </div>

      {/* Payment Modal - Compact & Professional Design */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-border bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">Complete Payment</h3>
                <p className="text-xs text-gray-600 dark:text-muted-foreground mt-0.5">FIB secure payment gateway</p>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="p-2 hover:bg-white/60 dark:hover:bg-accent rounded-full transition-colors"
                aria-label="Close payment modal"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-foreground" />
              </button>
            </div>

            <div className="px-5 py-5">
              {/* QR Code Section */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md">
                  <QrCode className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h4 className="text-base font-semibold mb-1.5 dark:text-foreground">Scan to Pay</h4>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-5">
                  Use your FIB app to scan the QR code below
                </p>

                {/* QR Code Display (Stays white for scanning) */}
                <div className="bg-white border-2 border-gray-200 dark:border-border rounded-xl p-4 mb-4 inline-block shadow-md">
                  {qrCodeUrl ? (
                    <img 
                      src={qrCodeUrl} 
                      alt="Payment QR Code" 
                      className="w-40 h-40 rounded-lg object-cover" 
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                      <QrCode className="w-20 h-20 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Payment Details Card */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-muted/40 dark:to-muted/60 rounded-xl p-3.5 mb-5 border border-gray-200 dark:border-border text-left">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600 dark:text-muted-foreground font-medium">Amount Due</span>
                    <span className="text-base font-bold text-gray-900 dark:text-foreground">{formatIqd(paymentAmountIqd ?? totalIqd)} IQD</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-3 border-t border-gray-200 dark:border-border">
                    <span className="text-sm text-gray-600 dark:text-muted-foreground flex-shrink-0">Payment ID</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-muted-foreground/60 text-right break-all">{paymentId || "Generating..."}</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-border"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-white dark:bg-card text-xs text-gray-500 dark:text-muted-foreground font-medium">Or pay directly</span>
                  </div>
                </div>

                {/* Pay Now Button */}
                <button
                  onClick={() => void handlePayNow()}
                  className="w-full h-12 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 active:scale-[0.98] text-black rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl text-sm"
                >
                  Pay Now in App
                </button>
                <p className="text-xs text-gray-500 mt-2.5">
                  Complete payment securely within our app
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Modal - Already has good design, minor enhancements */}
      {showLoyaltyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30">
              <h3 className="text-xl font-medium dark:text-foreground">Confirm Purchase</h3>
              <button onClick={() => setShowLoyaltyModal(false)} className="p-2 hover:bg-white/60 dark:hover:bg-accent rounded-full transition-colors">
                <X className="w-5 h-5 dark:text-foreground" />
              </button>
            </div>

            <div className="p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Crown className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="text-lg font-medium mb-2 dark:text-foreground">Buy Now, Pay Later</h4>
                <p className="text-sm text-gray-500 dark:text-muted-foreground mb-6">
                  Confirm your purchase using your Loyalty Program benefits.
                </p>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-muted/40 dark:to-muted/60 rounded-xl p-4 mb-4 border-2 border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-600 dark:text-muted-foreground">Plan</span>
                    <span className="font-medium dark:text-foreground">{plan.data} GB - {plan.validity} days</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-600 dark:text-muted-foreground">Country</span>
                    <span className="font-medium flex items-center gap-2 dark:text-foreground">
                      <CountryFlag
                        code={country.code}
                        emoji={country.flag}
                        className="h-5 w-7 rounded-sm object-cover"
                      />
                      {country.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-purple-200 dark:border-purple-800">
                    <span className="text-gray-600 dark:text-muted-foreground">Total</span>
                    <span className="font-bold text-purple-900 dark:text-purple-400">{formatIqd(totalIqd)} IQD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Payment Method</span>
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-purple-900 dark:text-purple-300">Loyalty Program</span>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3 mb-6 border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-800 dark:text-purple-300">
                    ✓ Your eSIM will be activated immediately.<br />
                    ✓ Payment will be processed through your loyalty account.
                  </p>
                </div>

                <Button
                  onClick={confirmLoyaltyPurchase}
                  className="w-full h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl font-medium mb-3 shadow-lg"
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Confirm Purchase
                </Button>

                <button
                  onClick={() => setShowLoyaltyModal(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
