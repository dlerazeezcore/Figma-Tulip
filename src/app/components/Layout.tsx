import { useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import { Home, ShoppingBag, User } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Route changes should always start at top-left.
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* Main Content */}
      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>

      {/* Bottom Navigation - Professional & Premium */}
      <nav className="safe-area-bottom-tight border-t border-border/50 bg-white/95 dark:bg-card/95 backdrop-blur-lg">
        <div className="flex h-20 items-center justify-around px-2">
          <NavLink
            to="/"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative group"
          >
            {({ isActive }) => (
              <>
                {/* Top indicator bar */}
                <div
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-b-full transition-all duration-300 ${
                    isActive
                      ? "w-16 bg-gradient-to-r from-primary/80 via-primary to-primary/80"
                      : "w-0 bg-transparent"
                  }`}
                />

                {/* Icon */}
                <div className={`transition-all duration-200 ${isActive ? "scale-110" : "scale-100 group-hover:scale-105"}`}>
                  <Home
                    className={`transition-all duration-200 ${
                      isActive ? "w-7 h-7 text-primary stroke-[2.5]" : "w-6 h-6 text-muted-foreground stroke-2"
                    }`}
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-xs transition-all duration-200 ${
                    isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                  }`}
                >
                  Home
                </span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/bookings"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative group"
          >
            {({ isActive }) => (
              <>
                {/* Top indicator bar */}
                <div
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-b-full transition-all duration-300 ${
                    isActive
                      ? "w-16 bg-gradient-to-r from-primary/80 via-primary to-primary/80"
                      : "w-0 bg-transparent"
                  }`}
                />

                {/* Icon */}
                <div className={`transition-all duration-200 ${isActive ? "scale-110" : "scale-100 group-hover:scale-105"}`}>
                  <ShoppingBag
                    className={`transition-all duration-200 ${
                      isActive ? "w-7 h-7 text-primary stroke-[2.5]" : "w-6 h-6 text-muted-foreground stroke-2"
                    }`}
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-xs transition-all duration-200 ${
                    isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                  }`}
                >
                  Bookings
                </span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/settings"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative group"
          >
            {({ isActive }) => (
              <>
                {/* Top indicator bar */}
                <div
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-b-full transition-all duration-300 ${
                    isActive
                      ? "w-16 bg-gradient-to-r from-primary/80 via-primary to-primary/80"
                      : "w-0 bg-transparent"
                  }`}
                />

                {/* Icon */}
                <div className={`transition-all duration-200 ${isActive ? "scale-110" : "scale-100 group-hover:scale-105"}`}>
                  <User
                    className={`transition-all duration-200 ${
                      isActive ? "w-7 h-7 text-primary stroke-[2.5]" : "w-6 h-6 text-muted-foreground stroke-2"
                    }`}
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-xs transition-all duration-200 ${
                    isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                  }`}
                >
                  Profile
                </span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}