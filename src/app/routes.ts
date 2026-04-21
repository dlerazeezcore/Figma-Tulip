import { createElement, type ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";

function lazyComponent<T extends Record<string, any>>(loader: () => Promise<T>, exportName: keyof T) {
  return async () => {
    const module = await loader();
    return { Component: module[exportName] as ComponentType };
  };
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    hydrateFallbackElement: createElement(
      "div",
      { className: "flex h-dvh items-center justify-center bg-background" },
      createElement("div", { className: "text-sm text-muted-foreground" }, "Loading..."),
    ),
    children: [
      { index: true, lazy: lazyComponent(() => import("./pages/Home"), "Home") },
      { path: "plans", lazy: lazyComponent(() => import("./pages/Plans"), "Plans") },
      { path: "bookings", lazy: lazyComponent(() => import("./pages/Bookings"), "Bookings") },
      { path: "bookings/flights", lazy: lazyComponent(() => import("./pages/FlightBookings"), "FlightBookings") },
      { path: "bookings/hotels", lazy: lazyComponent(() => import("./pages/HotelBookings"), "HotelBookings") },
      { path: "flights", lazy: lazyComponent(() => import("./pages/flights/FlightSearchFlow"), "FlightSearchFlow") },
      { path: "flights/results", lazy: lazyComponent(() => import("./pages/flights/FlightResults"), "FlightResults") },
      { path: "flights/fare-families/:id", lazy: lazyComponent(() => import("./pages/flights/FareFamilySelection"), "FareFamilySelection") },
      { path: "flights/summary", lazy: lazyComponent(() => import("./pages/flights/FlightSummary"), "FlightSummary") },
      { path: "my-esims", lazy: lazyComponent(() => import("./pages/MyEsims"), "MyEsims") },
      { path: "settings", lazy: lazyComponent(() => import("./pages/Settings"), "Settings") },
      {
        path: "settings/personal-information",
        lazy: lazyComponent(() => import("./pages/PersonalInformation"), "PersonalInformation"),
      },
      { path: "support", lazy: lazyComponent(() => import("./pages/Support"), "Support") },
      { path: "coming-soon", lazy: lazyComponent(() => import("./pages/ComingSoon"), "ComingSoon") },
      { path: "feedback-system", lazy: lazyComponent(() => import("./pages/FeedbackSystem"), "FeedbackSystem") },
      { path: "admin", lazy: lazyComponent(() => import("./components/AdminRoute"), "AdminRoute") },
      { path: "*", lazy: lazyComponent(() => import("./pages/NotFound"), "NotFound") },
    ],
  },
  {
    path: "/checkout",
    lazy: lazyComponent(() => import("./pages/Checkout"), "Checkout"),
  },
  {
    path: "/admin-web",
    lazy: lazyComponent(() => import("./components/AdminWebRoute"), "AdminWebRoute"),
  },
]);