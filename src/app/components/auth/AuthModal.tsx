import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CountryFlag } from "../ui/country-flag";
import { Input } from "../ui/input";
import { User, Phone, Lock, ChevronDown, X, Eye, EyeOff, MessageSquare, ArrowLeft, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  login,
  loginWithOtp,
  requestUserOtp,
  resetPasswordWithOtp,
  signup,
  signupWithOtp,
  type OtpChannel,
} from "../../wiring/account-service";
import { markLoginSubmit, markLoginTokenReceived } from "../../wiring/perf-telemetry";
import { triggerPostLoginBootstrap } from "../../wiring/post-login-bootstrap-service";

interface CountryCode {
  code: string;
  dial: string;
  flag: string;
  name: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: "login" | "signup";
  redirectToHomeOnSuccess?: boolean;
}

type AuthMethod = "password" | "sms" | "whatsapp";
type AuthStep = "method" | "phone" | "otp" | "password" | "name";
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_CODE_LENGTH = 4;

function withServerDetail(fallbackMessage: string, detail?: string): string {
  const cleanDetail = String(detail || "").trim();
  if (!cleanDetail) {
    return fallbackMessage;
  }
  if (cleanDetail.toLowerCase() === fallbackMessage.trim().toLowerCase()) {
    return fallbackMessage;
  }
  return cleanDetail;
}

function resolveOtpRequestError(statusCode?: number, detail?: string, channel: OtpChannel = "sms"): string {
  if (statusCode === 403) {
    return withServerDetail("This account is inactive or forbidden.", detail);
  }
  if (statusCode === 422) {
    return withServerDetail(`Invalid phone number or unsupported ${channel} channel.`, detail);
  }
  if (statusCode === 503) {
    return withServerDetail("OTP provider is not configured right now.", detail);
  }
  return withServerDetail("Unable to send verification code right now.", detail);
}

function resolveSignupError(statusCode?: number, detail?: string): string {
  if (statusCode === 401) {
    return withServerDetail("Invalid or expired OTP code.", detail);
  }
  if (statusCode === 403) {
    return withServerDetail("This account is inactive or forbidden.", detail);
  }
  if (statusCode === 409) {
    return withServerDetail("An account already exists for this phone.", detail);
  }
  if (statusCode === 422) {
    return withServerDetail("Invalid sign-up payload.", detail);
  }
  if (statusCode === 503) {
    return withServerDetail("OTP provider is not configured right now.", detail);
  }
  return withServerDetail("Unable to create account.", detail);
}

function resolveLoginError(statusCode?: number, detail?: string): string {
  if (statusCode === 401) {
    return withServerDetail("Invalid credentials or expired OTP code.", detail);
  }
  if (statusCode === 403) {
    return withServerDetail("This account is inactive or forbidden.", detail);
  }
  if (statusCode === 404) {
    return withServerDetail("User account not found. Please sign up first.", detail);
  }
  if (statusCode === 422) {
    return withServerDetail("Invalid login payload.", detail);
  }
  return withServerDetail("Unable to log in.", detail);
}

function resolveForgotPasswordError(statusCode?: number, detail?: string): string {
  if (statusCode === 401) {
    return withServerDetail("Invalid or expired OTP code.", detail);
  }
  if (statusCode === 403) {
    return withServerDetail("This account is inactive or forbidden.", detail);
  }
  if (statusCode === 404) {
    return withServerDetail("User not found.", detail);
  }
  if (statusCode === 422) {
    return withServerDetail("Invalid password reset payload.", detail);
  }
  return withServerDetail("Unable to reset password.", detail);
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "signup",
  redirectToHomeOnSuccess = true,
}: AuthModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [currentStep, setCurrentStep] = useState<AuthStep>("method");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState("+964");
  const [showCountryCodeDropdown, setShowCountryCodeDropdown] = useState(false);
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);

  const buildFullPhoneNumber = () => {
    const dial = selectedCountryCode.startsWith("+") ? selectedCountryCode : `+${selectedCountryCode}`;
    const dialDigits = dial.replace(/[^\d]/g, "");
    let localDigits = phoneNumber.replace(/[^\d]/g, "");

    if (dialDigits) {
      if (localDigits.startsWith(`00${dialDigits}`)) {
        localDigits = localDigits.slice(2 + dialDigits.length);
      } else if (localDigits.startsWith(dialDigits)) {
        localDigits = localDigits.slice(dialDigits.length);
      }
    }

    const local = localDigits.replace(/^0+/, "");
    return local && dialDigits ? `+${dialDigits}${local}` : "";
  };

  const countryCodes: CountryCode[] = [
    { code: "IQ", dial: "+964", flag: "🇮🇶", name: "Iraq" },
    { code: "US", dial: "+1", flag: "🇺🇸", name: "United States" },
    { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom" },
    { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada" },
    { code: "AU", dial: "+61", flag: "🇦🇺", name: "Australia" },
    { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany" },
    { code: "FR", dial: "+33", flag: "🇫🇷", name: "France" },
    { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italy" },
    { code: "ES", dial: "+34", flag: "🇪🇸", name: "Spain" },
    { code: "NL", dial: "+31", flag: "🇳🇱", name: "Netherlands" },
    { code: "AE", dial: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
    { code: "SA", dial: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "TR", dial: "+90", flag: "🇹🇷", name: "Turkey" },
    { code: "EG", dial: "+20", flag: "🇪🇬", name: "Egypt" },
    { code: "IN", dial: "+91", flag: "🇮🇳", name: "India" },
    { code: "SG", dial: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "JP", dial: "+81", flag: "🇯🇵", name: "Japan" },
    { code: "KR", dial: "+82", flag: "🇰🇷", name: "South Korea" },
  ];

  // Reset form when modal opens or mode changes
  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setFullName("");
      setPassword("");
      setConfirmPassword("");
      setOtp("");
      setIsSubmitting(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setSelectedCountryCode("+964");
      setAuthMode(initialMode);
      setCurrentStep("method");
      setAuthMethod("password");
      setOtpCooldownSeconds(0);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!otpCooldownSeconds) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpCooldownSeconds((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [otpCooldownSeconds]);

  const handleSuccessfulAuth = () => {
    markLoginTokenReceived();
    onClose();
    onSuccess?.();
    triggerPostLoginBootstrap("auth-modal-success");
    if (redirectToHomeOnSuccess) {
      navigate("/", { replace: true });
    }
  };

  const handleMethodSelect = (method: AuthMethod) => {
    setAuthMethod(method);

    if (authMode === "signup") {
      // Sign up flow
      if (method === "password") {
        setCurrentStep("name");
      } else {
        // SMS or WhatsApp - need phone first
        setCurrentStep("phone");
      }
    } else if (authMode === "login") {
      // Login flow
      if (method === "password") {
        // For password login, show combined phone + password screen
        setCurrentStep("password");
      } else {
        // SMS or WhatsApp - need phone first
        setCurrentStep("phone");
      }
    } else {
      // Forgot password - always need phone
      setCurrentStep("phone");
    }
  };

  const handleSendOTP = async () => {
    if (isSubmitting) {
      return;
    }

    const fullPhoneNumber = buildFullPhoneNumber();
    if (!fullPhoneNumber) {
      toast.error("Please enter your phone number");
      return;
    }
    if (otpCooldownSeconds > 0) {
      return;
    }

    const channel: OtpChannel = authMethod === "whatsapp" ? "whatsapp" : "sms";

    try {
      setIsSubmitting(true);
      const response = await requestUserOtp(fullPhoneNumber, channel);
      if (!response.success) {
        toast.error(resolveOtpRequestError(response.statusCode, response.error, channel));
        return;
      }

      const label = response.data?.channel === "whatsapp" ? "WhatsApp" : "SMS";
      toast.success(t("OTP sent via {{- label}} to {{- phone}}", { label, phone: response.data?.to || fullPhoneNumber }));
      setOtpCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
      setCurrentStep("otp");
    } catch (error) {
      console.error("OTP request error:", error);
      toast.error(t("Unable to send verification code right now."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (isSubmitting) {
      return;
    }

    if (otp.length !== OTP_CODE_LENGTH) {
      toast.error(t("Please enter the {{- length}}-digit code", { length: OTP_CODE_LENGTH }));
      return;
    }

    const fullPhoneNumber = buildFullPhoneNumber();
    if (!fullPhoneNumber) {
      toast.error("Please enter your phone number");
      return;
    }

    if (authMode === "signup") {
      toast.success(t("Code received. Continue with your profile details."));
      setCurrentStep("name");
      return;
    }

    if (authMode === "forgot") {
      toast.success(t("Code received. Set your new password."));
      setCurrentStep("password");
      return;
    }

    try {
      markLoginSubmit();
      setIsSubmitting(true);
      const response = await loginWithOtp(
        fullPhoneNumber,
        otp,
        authMethod === "whatsapp" ? "whatsapp" : "sms",
      );
      if (!response.success) {
        toast.error(resolveLoginError(response.statusCode, response.error));
        return;
      }

      toast.success(t("Logged in successfully"));
      handleSuccessfulAuth();
    } catch (error) {
      console.error("OTP login error:", error);
      toast.error(t("Unable to log in right now."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteAuth = async () => {
    if (isSubmitting) {
      return;
    }

    const fullPhoneNumber = buildFullPhoneNumber();

    if (authMode === "signup") {
      if (!fullName.trim()) {
        toast.error("Please enter your full name");
        return;
      }
      if (!fullPhoneNumber) {
        toast.error("Please enter your phone number");
        return;
      }

      if (authMethod === "password") {
        if (!password.trim()) {
          toast.error("Please enter your password");
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }
      } else {
        if (otp.length !== OTP_CODE_LENGTH) {
          toast.error(`Please enter the ${OTP_CODE_LENGTH}-digit code`);
          setCurrentStep("otp");
          return;
        }
      }

      try {
        markLoginSubmit();
        setIsSubmitting(true);
        const response =
          authMethod === "password"
            ? await signup(fullPhoneNumber, fullName, password)
            : await signupWithOtp(
                fullPhoneNumber,
                fullName,
                otp,
                authMethod === "whatsapp" ? "whatsapp" : "sms",
              );

        if (!response.success) {
          toast.error(resolveSignupError(response.statusCode, response.error));
          return;
        }

        toast.success("Account created successfully");
        handleSuccessfulAuth();
      } catch (error) {
        console.error("Signup error:", error);
        toast.error("Unable to create account right now.");
      } finally {
        setIsSubmitting(false);
      }
    } else if (authMode === "login") {
      if (!fullPhoneNumber) {
        toast.error("Please enter your phone number");
        return;
      }

      if (authMethod === "password") {
        if (!password.trim()) {
          toast.error("Please enter your password");
          return;
        }
      } else {
        if (otp.length !== OTP_CODE_LENGTH) {
          toast.error(`Please enter the ${OTP_CODE_LENGTH}-digit code`);
          return;
        }
      }

      try {
        markLoginSubmit();
        setIsSubmitting(true);
        const response =
          authMethod === "password"
            ? await login(fullPhoneNumber, password)
            : await loginWithOtp(
                fullPhoneNumber,
                otp,
                authMethod === "whatsapp" ? "whatsapp" : "sms",
              );

        if (!response.success) {
          toast.error(resolveLoginError(response.statusCode, response.error));
          return;
        }

        toast.success("Logged in successfully");
        handleSuccessfulAuth();
      } catch (error) {
        console.error("Login error:", error);
        toast.error("Unable to log in right now.");
      } finally {
        setIsSubmitting(false);
      }
    } else if (authMode === "forgot") {
      if (!fullPhoneNumber) {
        toast.error("Please enter your phone number");
        return;
      }
      if (otp.length !== OTP_CODE_LENGTH) {
        toast.error(`Please enter the ${OTP_CODE_LENGTH}-digit code`);
        setCurrentStep("otp");
        return;
      }
      if (!password.trim()) {
        toast.error("Please enter your new password");
        return;
      }
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      try {
        setIsSubmitting(true);
        const response = await resetPasswordWithOtp(
          fullPhoneNumber,
          otp,
          password,
          authMethod === "whatsapp" ? "whatsapp" : "sms",
        );

        if (!response.success) {
          toast.error(resolveForgotPasswordError(response.statusCode, response.error));
          return;
        }

        toast.success(t("Password reset successfully"));
        onClose();
        onSuccess?.();
      } catch (error) {
        console.error("Forgot-password reset error:", error);
        toast.error(t("Unable to reset password right now."));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep === "otp") {
      setCurrentStep("phone");
      setOtp("");
    } else if (currentStep === "phone" || currentStep === "name") {
      setCurrentStep("method");
      setPassword("");
      setConfirmPassword("");
      setPhoneNumber("");
      setFullName("");
    } else if (currentStep === "password") {
      // For login with password, go back to method selection
      // For signup/forgot, also go back to appropriate step
      if (authMode === "login" && authMethod === "password") {
        setCurrentStep("method");
        setPassword("");
        setPhoneNumber("");
      } else {
        setCurrentStep("method");
        setPassword("");
        setConfirmPassword("");
        setPhoneNumber("");
        setFullName("");
      }
    }
  };

  if (!isOpen) return null;

  const getTitle = () => {
    if (authMode === "forgot") return t("Reset Password");
    if (authMode === "signup") return t("Create Account");
    return t("Welcome Back");
  };

  const getSubtitle = () => {
    if (authMode === "forgot") return t("Recover your account access");
    if (authMode === "signup") return t("Sign up to manage your eSIMs");
    return t("Log in to access your account");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-6 pb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 flex items-center justify-between mb-3">
            {currentStep !== "method" && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors -ml-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors -mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <h3 className="text-2xl font-semibold mb-1">{getTitle()}</h3>
          <p className="text-sm text-white/80">{getSubtitle()}</p>
        </div>

        <div className="p-6">
          {/* Method Selection Step */}
          {currentStep === "method" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-6">
                {t("Choose your preferred")} {authMode === "signup" ? t("sign up") : authMode === "forgot" ? t("verification") : t("login")} {t("method")}
              </p>

              {authMode === "login" && (
                <MethodCard
                  icon={<Lock className="w-6 h-6 text-blue-600" />}
                  iconBg="bg-blue-100"
                  title={t("Password")}
                  description={t("Use your password to log in")}
                  onClick={() => handleMethodSelect("password")}
                />
              )}

              {authMode === "signup" && (
                <MethodCard
                  icon={<Lock className="w-6 h-6 text-blue-600" />}
                  iconBg="bg-blue-100"
                  title={t("Password")}
                  description={t("Create account with password")}
                  onClick={() => handleMethodSelect("password")}
                />
              )}

              <MethodCard
                icon={<MessageSquare className="w-6 h-6 text-green-600" />}
                iconBg="bg-green-100"
                title={t("SMS OTP")}
                description={t("Receive verification code via SMS")}
                onClick={() => handleMethodSelect("sms")}
              />

              <MethodCard
                icon={<MessageSquare className="w-6 h-6 text-emerald-600" />}
                iconBg="bg-emerald-100"
                title={t("WhatsApp OTP")}
                description={t("Receive verification code via WhatsApp")}
                onClick={() => handleMethodSelect("whatsapp")}
              />

              {authMode === "login" && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setAuthMode("forgot");
                      setCurrentStep("method");
                    }}
                    className="text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    {t("Forgot your password?")}
                  </button>
                </div>
              )}

              <div className="text-center pt-4">
                <button
                  onClick={() => {
                    setAuthMode(authMode === "signup" ? "login" : "signup");
                    setCurrentStep("method");
                  }}
                  className="text-sm text-gray-600"
                >
                  {authMode === "signup" ? t("Already have an account? ") : t("Don't have an account? ")}
                  <span className="text-primary font-medium">
                    {authMode === "signup" ? t("Log In") : t("Sign Up")}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Phone Number Step */}
          {currentStep === "phone" && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                <p className="text-sm text-blue-900 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {authMethod === "sms" && t("We'll send a {{- length}}-digit code via SMS", { length: OTP_CODE_LENGTH })}
                  {authMethod === "whatsapp" && t("We'll send a {{- length}}-digit code via WhatsApp", { length: OTP_CODE_LENGTH })}
                  {authMethod === "password" && t("Enter your phone number to continue")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">{t("Phone Number")}</label>
                <div className="flex gap-2">
                  {/* Country Code Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCountryCodeDropdown(!showCountryCodeDropdown)}
                      className="h-12 px-3 flex items-center gap-2 border border-gray-200 dark:border-border rounded-xl bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-accent transition-colors shadow-sm"
                    >
                      <CountryFlag
                        code={countryCodes.find((c) => c.dial === selectedCountryCode)?.code}
                        emoji={countryCodes.find((c) => c.dial === selectedCountryCode)?.flag || "🇮🇶"}
                        className="h-5 w-7 rounded-sm object-cover"
                      />
                      <span className="text-sm font-medium">{selectedCountryCode}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>

                    {showCountryCodeDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-72 max-h-60 overflow-y-auto bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-xl z-50">
                        {countryCodes.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountryCode(country.dial);
                              setShowCountryCodeDropdown(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-accent transition-colors text-left"
                          >
                            <CountryFlag
                              code={country.code}
                              emoji={country.flag}
                              className="h-5 w-7 rounded-sm object-cover"
                            />
                            <span className="flex-1 text-sm">{country.name}</span>
                            <span className="text-sm font-medium text-gray-600">{country.dial}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone Number Input */}
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="tel"
                      placeholder="7XX XXX XXXX"
                      className="pl-10 h-12 rounded-xl shadow-sm"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (authMethod === "password") {
                            if (!buildFullPhoneNumber()) {
                              toast.error(t("Please enter your phone number"));
                              return;
                            }
                            setCurrentStep("password");
                          } else {
                            void handleSendOTP();
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white rounded-xl font-medium shadow-lg"
                disabled={isSubmitting}
                onClick={() => {
                  if (authMethod === "password") {
                    if (!buildFullPhoneNumber()) {
                      toast.error(t("Please enter your phone number"));
                      return;
                    }
                    setCurrentStep("password");
                  } else {
                    void handleSendOTP();
                  }
                }}
              >
                {isSubmitting
                  ? (authMethod === "password" ? t("Continuing...") : t("Sending..."))
                  : (authMethod === "password" ? t("Continue") : t("Send OTP"))}
              </Button>
            </div>
          )}

          {/* OTP Verification Step */}
          {currentStep === "otp" && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4">
                <p className="text-sm text-green-900 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {t("Code sent to {{- phone}} via {{- method}}", { phone: buildFullPhoneNumber(), method: authMethod === "sms" ? "SMS" : "WhatsApp" })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  {t("Enter {{- length}}-Digit Code", { length: OTP_CODE_LENGTH })}
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={OTP_CODE_LENGTH}
                  placeholder={"0".repeat(OTP_CODE_LENGTH)}
                  className="h-14 text-center text-2xl tracking-widest font-mono rounded-xl shadow-sm"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otp.length === OTP_CODE_LENGTH) {
                      void handleVerifyOTP();
                    }
                  }}
                  autoFocus
                />
              </div>

              <Button
                className="w-full h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white rounded-xl font-medium shadow-lg"
                disabled={isSubmitting || otp.length !== OTP_CODE_LENGTH}
                onClick={() => void handleVerifyOTP()}
              >
                {isSubmitting ? "Verifying..." : "Verify Code"}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => void handleSendOTP()}
                  className="text-sm text-primary hover:text-primary-hover transition-colors"
                  disabled={isSubmitting || otpCooldownSeconds > 0}
                >
                  {otpCooldownSeconds > 0
                    ? t("Resend code in {{- seconds}}s", { seconds: otpCooldownSeconds })
                    : t("Didn't receive the code? Resend")}
                </button>
              </div>
            </div>
          )}

          {/* Name Entry Step (Signup) */}
          {currentStep === "name" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">{t("Full Name")}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="John Doe"
                    className="pl-10 h-12 rounded-xl shadow-sm"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (authMethod === "password") {
                          setCurrentStep("phone");
                        } else {
                          // OTP methods - complete signup
                          void handleCompleteAuth();
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <Button
                className="w-full h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white rounded-xl font-medium shadow-lg"
                disabled={isSubmitting}
                onClick={() => {
                  if (authMethod === "password") {
                    setCurrentStep("phone");
                  } else {
                    // OTP methods - complete signup
                    void handleCompleteAuth();
                  }
                }}
              >
                {authMethod === "password" ? t("Continue") : t("Complete Sign Up")}
              </Button>

              {authMethod === "password" && (
                <p className="text-xs text-gray-500 text-center">
                  {t("Next: Enter phone number and create password")}
                </p>
              )}
            </div>
          )}

          {/* Password Step */}
          {currentStep === "password" && (
            <div className="space-y-6">
              {authMode === "login" && authMethod === "password" && (
                <>
                  {/* Phone Number Field */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">{t("Phone Number")}</label>
                    <div className="flex gap-2">
                      {/* Country Code Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryCodeDropdown(!showCountryCodeDropdown)}
                          className="h-12 px-3 flex items-center gap-2 border border-gray-200 dark:border-border rounded-xl bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-accent transition-colors shadow-sm"
                        >
                          <CountryFlag
                            code={countryCodes.find((c) => c.dial === selectedCountryCode)?.code}
                            emoji={countryCodes.find((c) => c.dial === selectedCountryCode)?.flag || "🇮🇶"}
                            className="h-5 w-7 rounded-sm object-cover"
                          />
                          <span className="text-sm font-medium">{selectedCountryCode}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>

                        {showCountryCodeDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-72 max-h-60 overflow-y-auto bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-xl z-50">
                            {countryCodes.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  setSelectedCountryCode(country.dial);
                                  setShowCountryCodeDropdown(false);
                                }}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-accent transition-colors text-left"
                              >
                                <CountryFlag
                                  code={country.code}
                                  emoji={country.flag}
                                  className="h-5 w-7 rounded-sm object-cover"
                                />
                                <span className="flex-1 text-sm">{country.name}</span>
                                <span className="text-sm font-medium text-gray-600">{country.dial}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Phone Number Input */}
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="tel"
                          placeholder="7XX XXX XXXX"
                          className="pl-10 h-12 rounded-xl shadow-sm"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">{t("Password")}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-12 h-12 rounded-xl shadow-sm"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleCompleteAuth();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white rounded-xl font-medium shadow-lg"
                    disabled={isSubmitting}
                    onClick={() => void handleCompleteAuth()}
                  >
                    {isSubmitting ? t("Logging in...") : t("Log In")}
                  </Button>

                  <div className="text-center">
                    <button
                      onClick={() => {
                        setAuthMode("forgot");
                        setCurrentStep("method");
                      }}
                      className="text-sm text-primary hover:text-primary-hover transition-colors font-medium"
                    >
                      {t("Forgot your password?")}
                    </button>
                  </div>
                </>
              )}

              {(authMode === "signup" || authMode === "forgot") && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      {authMode === "forgot" ? t("New Password") : t("Create Password")}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-12 h-12 rounded-xl shadow-sm"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t("Minimum 6 characters")}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">{t("Confirm Password")}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-12 h-12 rounded-xl shadow-sm"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleCompleteAuth();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white rounded-xl font-medium shadow-lg"
                    disabled={isSubmitting}
                    onClick={() => void handleCompleteAuth()}
                  >
                    {isSubmitting
                      ? (authMode === "forgot" ? t("Resetting...") : t("Creating..."))
                      : (authMode === "forgot" ? t("Reset Password") : t("Create Account"))}
                  </Button>
                </>
              )}

              {authMode === "signup" && (
                <p className="text-xs text-gray-500 text-center">
                  {t("By signing up, you agree to our")}{" "}
                  <span className="underline cursor-pointer">{t("Terms of Service")}</span> {t("and")}{" "}
                  <span className="underline cursor-pointer">{t("Privacy Policy")}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodCard({
  icon,
  iconBg,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-xl border border-gray-100 dark:border-border shadow-md bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-accent hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-foreground mb-0.5">{title}</h4>
          <p className="text-sm text-gray-500 dark:text-muted-foreground">{description}</p>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400 dark:text-muted-foreground -rotate-90" />
      </div>
    </button>
  );
}
