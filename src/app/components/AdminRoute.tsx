import { Navigate } from "react-router";
import { isAuthenticated } from "../wiring/session";

export function AdminRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/settings" replace />;
  }

  return <Navigate to="/admin-web" replace />;
}
