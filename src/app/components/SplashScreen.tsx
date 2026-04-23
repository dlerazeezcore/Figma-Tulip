import { useEffect, useState } from "react";
import { Plane, Hotel } from "lucide-react";
import { EsimIcon } from "./EsimIcon";
import tulipLogo from "../../imports/Tulipbooking_copy.svg";

import { useTranslation } from "react-i18next";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);
  const [currentProduct, setCurrentProduct] = useState(0);
  const [showBrand, setShowBrand] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const products = [
    { icon: Plane, name: t("Flights"), color: "from-blue-500 to-cyan-500", bgColor: "from-blue-50 to-cyan-50" },
    { icon: Hotel, name: t("Hotels"), color: "from-purple-500 to-pink-500", bgColor: "from-purple-50 to-pink-50" },
    { icon: EsimIcon, name: t("eSIM"), color: "from-primary to-blue-600", bgColor: "from-blue-50 to-indigo-50" },
  ];

  useEffect(() => {
    // Show first product immediately
    const timers: NodeJS.Timeout[] = [];

    // Cycle through products (0 -> 1 -> 2)
    timers.push(setTimeout(() => setCurrentProduct(1), 900));
    timers.push(setTimeout(() => setCurrentProduct(2), 1800));
    
    // Show brand at the end
    timers.push(setTimeout(() => {
      setCurrentProduct(-1);
      setShowBrand(true);
    }, 2700));

    // Fade out and complete
    timers.push(setTimeout(() => {
      setIsVisible(false);
    }, 3800));

    timers.push(setTimeout(() => {
      onComplete();
    }, 4100));

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [onComplete]);

  if (!isVisible && !showBrand) return null;

  const CurrentIcon = currentProduct >= 0 && currentProduct < products.length 
    ? products[currentProduct].icon 
    : EsimIcon;
  
  const currentColors = currentProduct >= 0 && currentProduct < products.length
    ? products[currentProduct]
    : products[2];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-300 ${
        !isVisible ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Dynamic gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br transition-all duration-700 ${
        showBrand 
          ? "from-[#1967D2] via-[#1557B0] to-[#114A99]"
          : currentProduct >= 0 
          ? `${currentColors.bgColor}`
          : "from-gray-50 to-blue-50"
      }`}>
        {/* Animated background orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {!showBrand ? (
          // Product showcase
          <div className="flex flex-col items-center">
            {/* Icon container */}
            <div
              className="relative mb-6 transition-all duration-500"
              style={{
                transform: currentProduct >= 0 ? "scale(1)" : "scale(0.8)",
                opacity: currentProduct >= 0 ? 1 : 0,
              }}
            >
              {/* Pulsing rings */}
              <div className="absolute inset-0 -m-12">
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${currentColors.color} opacity-20 animate-ping`} style={{ animationDuration: "2s" }} />
              </div>
              <div className="absolute inset-0 -m-8">
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${currentColors.color} opacity-30 animate-ping`} style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
              </div>

              {/* Main icon circle */}
              <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${currentColors.color} shadow-2xl flex items-center justify-center transform transition-all duration-500`}>
                <CurrentIcon className="w-16 h-16 text-white" strokeWidth={2} />
              </div>
            </div>

            {/* Product name */}
            <div
              className="text-center transition-all duration-500"
              style={{
                transform: currentProduct >= 0 ? "translateY(0)" : "translateY(20px)",
                opacity: currentProduct >= 0 ? 1 : 0,
              }}
            >
              <h2 className={`text-4xl font-bold bg-gradient-to-r ${currentColors.color} bg-clip-text text-transparent mb-2`}>
                {currentProduct >= 0 ? products[currentProduct].name : ""}
              </h2>
              <div className="flex gap-1.5 justify-center mt-4">
                {products.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentProduct 
                        ? `w-8 bg-gradient-to-r ${currentColors.color}` 
                        : "w-1.5 bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Brand finale
          <div
            className="flex flex-col items-center transition-all duration-700"
            style={{
              transform: showBrand ? "scale(1)" : "scale(0.9)",
              opacity: showBrand ? 1 : 0,
            }}
          >
            {/* Logo */}
            <div className="relative mb-8">
              {/* Pulsing rings - matching product style */}
              <div className="absolute inset-0 -m-12">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white to-blue-200 opacity-20 animate-ping" style={{ animationDuration: "2s" }} />
              </div>
              <div className="absolute inset-0 -m-8">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white to-blue-200 opacity-30 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
              </div>
              
              {/* Circular logo container - matching product style */}
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-white to-blue-50 shadow-2xl flex items-center justify-center p-0 relative">
                {!logoFailed ? (
                  <img 
                    src={tulipLogo}
                    alt="Tulip" 
                    className="w-[101%] h-[101%] object-contain drop-shadow-md"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white">
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-4xl font-bold tracking-tight">T</span>
                      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.35em] pl-[0.35em]">
                        Tulip
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Brand name */}
            <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
              Tulip
            </h1>
            <p className="text-white/90 text-lg font-medium tracking-wide">
              {t("Your Travel Companion")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
