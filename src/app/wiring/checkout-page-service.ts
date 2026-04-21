import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { isAuthenticated } from "./account-service";
import { getCurrencySettings } from "./catalog-service";
import { completePendingPurchase, getLoyaltyStatus, purchaseWithFIB, purchaseWithLoyalty } from "./orders-service";
import { convertUsdToIqd } from "../utils/currency";
import { isNativeApp, openNativeBrowser } from "../utils/native-payment";

export interface CheckoutData {
  country: {
    name: string;
    flag: string;
    code?: string;
    type?: "country" | "regional";
  };
  plan: {
    id?: string;
    data: number;
    validity: number;
    price: number;
  };
}

interface CheckoutTotals {
  usdPrice: number;
  iqdPrice: number;
}

export type CheckoutPaymentMethod = "fib" | "loyalty";

export interface CheckoutPageModel {
  checkoutData: CheckoutData | null;
  totalIqd: number;
  selectedPaymentMethod: CheckoutPaymentMethod;
  autoTopUp: boolean;
  showPaymentModal: boolean;
  showLoyaltyModal: boolean;
  paymentLink: string;
  qrCodeUrl: string;
  paymentId: string;
  paymentAmountIqd: number | null;
  hasLoyaltyAccess: boolean;
  isProcessing: boolean;
  setSelectedPaymentMethod: (value: CheckoutPaymentMethod) => void;
  setAutoTopUp: (value: boolean) => void;
  setShowPaymentModal: (value: boolean) => void;
  setShowLoyaltyModal: (value: boolean) => void;
  handleContinue: () => void;
  handlePayNow: () => Promise<void>;
  confirmLoyaltyPurchase: () => void;
  navigateBack: () => void;
  navigateToPlans: () => void;
}

export function readCheckoutData(locationState: unknown): CheckoutData | null {
  if (locationState && typeof locationState === "object") {
    const data = locationState as CheckoutData;
    if (data?.country && data?.plan) {
      saveCheckoutData(data);
      return data;
    }
  }

  try {
    const stored = sessionStorage.getItem("checkoutData");
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as CheckoutData;
  } catch {
    return null;
  }
}

export function saveCheckoutData(data: CheckoutData): void {
  try {
    sessionStorage.setItem("checkoutData", JSON.stringify(data));
  } catch {
    // Ignore storage failures.
  }
}

export function isCheckoutAuthenticated(): boolean {
  return isAuthenticated();
}

export async function calculateCheckoutTotals(planUsdPrice: number): Promise<CheckoutTotals> {
  const settingsResponse = await getCurrencySettings();
  const exchangeRate = String(settingsResponse.data?.exchangeRate || "1320");
  const markupPercent = String(settingsResponse.data?.markupPercent || "0");
  const usdPrice = Number(planUsdPrice || 0);

  return {
    usdPrice,
    iqdPrice: convertUsdToIqd(usdPrice, exchangeRate, markupPercent),
  };
}

export function useCheckoutPageModel(): CheckoutPageModel {
  const navigate = useNavigate();
  const location = useLocation();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [totalIqd, setTotalIqd] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CheckoutPaymentMethod>("fib");
  const [autoTopUp, setAutoTopUp] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [paymentAmountIqd, setPaymentAmountIqd] = useState<number | null>(null);
  const [hasLoyaltyAccess, setHasLoyaltyAccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processedPaymentReturnRef = useRef("");

  useEffect(() => {
    if (!isCheckoutAuthenticated()) {
      toast.error("Please login first");
      navigate("/plans");
      return;
    }

    const data = readCheckoutData(location.state);
    if (!data) {
      setCheckoutData(null);
      return;
    }

    setCheckoutData(data);

    const loadTotals = async () => {
      const totals = await calculateCheckoutTotals(data.plan.price);
      setTotalIqd(totals.iqdPrice);
    };

    const loadLoyalty = async () => {
      const result = await getLoyaltyStatus();
      setHasLoyaltyAccess(Boolean(result.success && result.data?.hasAccess));
    };

    void loadTotals();
    void loadLoyalty();
  }, [location.state, navigate]);

  useEffect(() => {
    const status = new URLSearchParams(location.search).get("payment");
    if (!status) {
      return;
    }

    if (processedPaymentReturnRef.current === status) {
      return;
    }
    processedPaymentReturnRef.current = status;

    if (status === "cancelled") {
      setShowPaymentModal(false);
      toast.error("Payment cancelled", {
        description: "You can retry the payment whenever you're ready.",
      });
    } else if (status === "success") {
      const finalize = async () => {
        setIsProcessing(true);
        const result = await completePendingPurchase({
          paymentMethod: "fib",
          paymentStatus: "approved",
        });

        setShowPaymentModal(false);

        if (!result.success) {
          toast.error("Payment confirmation failed", {
            description: result.error || "Unable to finalize your eSIM order.",
          });
          setIsProcessing(false);
          return;
        }

        toast.success("Payment completed", {
          description: "Your eSIM order is confirmed successfully.",
        });
        setIsProcessing(false);
        window.setTimeout(() => {
          navigate("/my-esims?tab=inactive");
        }, 1200);
      };

      void finalize();
    }

    navigate(location.pathname, {
      replace: true,
      state: location.state,
    });
  }, [location.pathname, location.search, location.state, navigate]);

  const handleFibPurchase = async () => {
    const planId = String(checkoutData?.plan?.id || "").trim();
    if (!planId) {
      toast.error("Invalid plan data");
      return;
    }

    setIsProcessing(true);
    processedPaymentReturnRef.current = "";

    try {
      const result = await purchaseWithFIB(planId, autoTopUp);
      if (!result.success) {
        toast.error("Purchase failed", {
          description: result.error || "Unable to initiate payment",
        });
        setIsProcessing(false);
        return;
      }

      const paymentData = result.data || {};
      setQrCodeUrl(String(paymentData.qrCodeUrl || ""));
      setPaymentLink(String(paymentData.paymentLink || ""));
      setPaymentId(String(paymentData.paymentId || paymentData.reference || ""));
      setPaymentAmountIqd(Number(paymentData.amount) || totalIqd);
      setShowPaymentModal(true);
    } catch (error) {
      console.error("FIB purchase error:", error);
      toast.error("Payment initiation failed", {
        description: "Please try again later",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoyaltyPurchase = async () => {
    const planId = String(checkoutData?.plan?.id || "").trim();
    if (!planId) {
      toast.error("Invalid plan data");
      return;
    }

    setIsProcessing(true);

    try {
      const result = await purchaseWithLoyalty(planId, autoTopUp);
      if (!result.success) {
        toast.error("Purchase failed", {
          description: result.error || "Unable to complete purchase",
        });
        setIsProcessing(false);
        return;
      }

      toast.success("Purchase successful", {
        description: `Your ${checkoutData?.plan.data || 0} GB eSIM for ${checkoutData?.country.name || "your destination"} is being activated.`,
        duration: 3000,
      });

      window.setTimeout(() => {
        navigate("/my-esims?tab=inactive");
      }, 2000);
    } catch (error) {
      console.error("Loyalty purchase error:", error);
      toast.error("Purchase failed", {
        description: "Please try again later",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinue = () => {
    if (selectedPaymentMethod === "fib") {
      void handleFibPurchase();
      return;
    }

    setShowLoyaltyModal(true);
  };

  const handlePayNow = async () => {
    if (!paymentLink) {
      toast.error("Payment link not available");
      return;
    }

    try {
      if (isNativeApp()) {
        const opened = await openNativeBrowser(paymentLink);
        if (opened) {
          return;
        }
      }

      window.location.href = paymentLink;
    } catch (error) {
      console.error("Unable to open payment link:", error);
      toast.error("Unable to open payment page");
    }
  };

  const confirmLoyaltyPurchase = () => {
    setShowLoyaltyModal(false);
    void handleLoyaltyPurchase();
  };

  return {
    checkoutData,
    totalIqd,
    selectedPaymentMethod,
    autoTopUp,
    showPaymentModal,
    showLoyaltyModal,
    paymentLink,
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
    navigateBack: () => navigate(-1),
    navigateToPlans: () => navigate("/plans"),
  };
}
