import { useEffect } from "react";
import { isSuperAdmin } from "../wiring/esim-app-service";

export function InitSuperAdmin() {
  useEffect(() => {
    const initAdmin = async () => {
      try {
        await isSuperAdmin("+9647507343635");
      } catch (error) {
        console.error("Failed to initialize super admin:", error);
      }
    };

    initAdmin();
  }, []);

  return null;
}
