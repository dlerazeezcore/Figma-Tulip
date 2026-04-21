import { Navigate } from "react-router";
import { AdminWeb } from "../pages/AdminWeb";
import { isAuthenticated } from "../wiring/session";

export function AdminWebRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/settings" replace />;
  }

  return <AdminWeb />;
}
