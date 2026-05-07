import { loadHomePopularContent } from "./home-page-service";
import { addAuthSessionChangeListener, getAuthToken, getUserId } from "./session";

const POST_LOGIN_BOOTSTRAP_STALE_MS = 60 * 1000;
const POST_LOGIN_BOOTSTRAP_DELAY_MS = 30_000;

const bootstrapInFlightBySession = new Map<string, Promise<void>>();
const bootstrapLastRunAtBySession = new Map<string, number>();

let listenerRefCount = 0;
let removeAuthListener: (() => void) | null = null;
let lastObservedSessionKey = "";

function getActiveSessionKey(): string {
  const token = String(getAuthToken() || "").trim();
  const userId = String(getUserId() || "").trim();
  if (!token || !userId) {
    return "";
  }
  return `${userId}:${token.slice(-16)}`;
}

function runPostLoginBootstrap(sessionKey: string, reason: string): void {
  if (!sessionKey) {
    return;
  }

  const inFlight = bootstrapInFlightBySession.get(sessionKey);
  if (inFlight) {
    return;
  }

  const lastRunAt = bootstrapLastRunAtBySession.get(sessionKey) || 0;
  const now = Date.now();
  if (now - lastRunAt < POST_LOGIN_BOOTSTRAP_STALE_MS) {
    return;
  }

  const task = (async () => {
    await new Promise((resolve) => setTimeout(resolve, POST_LOGIN_BOOTSTRAP_DELAY_MS));
    await loadHomePopularContent();
    bootstrapLastRunAtBySession.set(sessionKey, Date.now());
    console.info(`[bootstrap] post-login bootstrap completed reason=${reason}`);
  })()
    .catch((error) => {
      console.warn(`[bootstrap] post-login bootstrap failed reason=${reason}`, error);
    })
    .finally(() => {
      if (bootstrapInFlightBySession.get(sessionKey) === task) {
        bootstrapInFlightBySession.delete(sessionKey);
      }
    });

  bootstrapInFlightBySession.set(sessionKey, task);
}

function handleAuthSessionChanged(): void {
  const activeSessionKey = getActiveSessionKey();
  if (!activeSessionKey) {
    lastObservedSessionKey = "";
    return;
  }

  if (activeSessionKey !== lastObservedSessionKey) {
    lastObservedSessionKey = activeSessionKey;
    runPostLoginBootstrap(activeSessionKey, "auth-session-changed");
    return;
  }

  runPostLoginBootstrap(activeSessionKey, "auth-session-refreshed");
}

export function triggerPostLoginBootstrap(reason = "manual-trigger"): void {
  const activeSessionKey = getActiveSessionKey();
  if (!activeSessionKey) {
    return;
  }
  lastObservedSessionKey = activeSessionKey;
  runPostLoginBootstrap(activeSessionKey, reason);
}

export function initializePostLoginBootstrapListener(): () => void {
  listenerRefCount += 1;

  if (!removeAuthListener) {
    removeAuthListener = addAuthSessionChangeListener(handleAuthSessionChanged);
    handleAuthSessionChanged();
  }

  return () => {
    listenerRefCount = Math.max(0, listenerRefCount - 1);
    if (listenerRefCount > 0) {
      return;
    }

    if (removeAuthListener) {
      removeAuthListener();
      removeAuthListener = null;
    }
    lastObservedSessionKey = "";
  };
}
