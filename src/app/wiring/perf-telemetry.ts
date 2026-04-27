interface LoginPerfState {
  loginSubmitAt: number;
  tokenReceivedAt: number;
  homeVisibleAt: number;
  apiWindowEndsAt: number;
  apiCallsInFirst10s: number;
  apiSamples: string[];
  reportedTokenAt: number;
}

const API_COUNT_WINDOW_MS = 10_000;
const MAX_API_SAMPLES = 12;

let state: LoginPerfState = {
  loginSubmitAt: 0,
  tokenReceivedAt: 0,
  homeVisibleAt: 0,
  apiWindowEndsAt: 0,
  apiCallsInFirst10s: 0,
  apiSamples: [],
  reportedTokenAt: 0,
};

let summaryTimerId: number | null = null;

function nowMs(): number {
  return Date.now();
}

function clearSummaryTimer(): void {
  if (summaryTimerId === null) {
    return;
  }
  window.clearTimeout(summaryTimerId);
  summaryTimerId = null;
}

function scheduleSummaryLog(): void {
  clearSummaryTimer();
  if (!state.tokenReceivedAt || !state.apiWindowEndsAt) {
    return;
  }
  const remainingMs = Math.max(0, state.apiWindowEndsAt - nowMs() + 40);
  summaryTimerId = window.setTimeout(() => {
    summaryTimerId = null;
    logLoginPerfSummary("first-10s-window-complete");
  }, remainingMs);
}

function logLoginPerfSummary(reason: string): void {
  if (!state.tokenReceivedAt) {
    return;
  }

  if (state.reportedTokenAt === state.tokenReceivedAt) {
    return;
  }

  if (nowMs() < state.apiWindowEndsAt) {
    return;
  }

  const submitToTokenMs =
    state.loginSubmitAt > 0 && state.tokenReceivedAt >= state.loginSubmitAt
      ? state.tokenReceivedAt - state.loginSubmitAt
      : -1;
  const tokenToHomeMs =
    state.homeVisibleAt > 0 && state.homeVisibleAt >= state.tokenReceivedAt
      ? state.homeVisibleAt - state.tokenReceivedAt
      : -1;

  console.info(
    `[perf][login-flow] reason=${reason} submit_to_token_ms=${submitToTokenMs} token_to_home_ms=${tokenToHomeMs} api_calls_first_10s=${state.apiCallsInFirst10s}`,
  );
  if (state.apiSamples.length > 0) {
    console.info(`[perf][login-flow] api_samples_first_10s=${state.apiSamples.join(" | ")}`);
  }

  state.reportedTokenAt = state.tokenReceivedAt;
}

export function markLoginSubmit(): void {
  const at = nowMs();
  state = {
    loginSubmitAt: at,
    tokenReceivedAt: 0,
    homeVisibleAt: 0,
    apiWindowEndsAt: 0,
    apiCallsInFirst10s: 0,
    apiSamples: [],
    reportedTokenAt: 0,
  };
  clearSummaryTimer();
  console.info(`[perf][login-flow] login_submit_at=${at}`);
}

export function markLoginTokenReceived(): void {
  const at = nowMs();
  if (!state.loginSubmitAt) {
    state.loginSubmitAt = at;
  }
  state.tokenReceivedAt = at;
  state.homeVisibleAt = 0;
  state.apiWindowEndsAt = at + API_COUNT_WINDOW_MS;
  state.apiCallsInFirst10s = 0;
  state.apiSamples = [];
  state.reportedTokenAt = 0;

  const submitToTokenMs = Math.max(0, at - state.loginSubmitAt);
  console.info(`[perf][login-flow] token_received submit_to_token_ms=${submitToTokenMs}`);
  scheduleSummaryLog();
}

export function markHomeVisible(): void {
  if (!state.tokenReceivedAt) {
    return;
  }
  if (state.homeVisibleAt > 0) {
    return;
  }

  state.homeVisibleAt = nowMs();
  const tokenToHomeMs = Math.max(0, state.homeVisibleAt - state.tokenReceivedAt);
  console.info(`[perf][login-flow] home_visible token_to_home_ms=${tokenToHomeMs}`);
  scheduleSummaryLog();
}

export function countApiCallInLoginWindow(method: string, pathOrUrl: string): void {
  if (!state.tokenReceivedAt || !state.apiWindowEndsAt) {
    return;
  }

  const now = nowMs();
  if (now > state.apiWindowEndsAt) {
    logLoginPerfSummary("api-window-ended");
    return;
  }

  state.apiCallsInFirst10s += 1;
  if (state.apiSamples.length < MAX_API_SAMPLES) {
    const normalizedMethod = String(method || "GET").toUpperCase();
    const normalizedPath = String(pathOrUrl || "").trim();
    state.apiSamples.push(`${normalizedMethod} ${normalizedPath}`);
  }
}

export function getLatestLoginPerfSnapshot(): {
  submitToTokenMs: number;
  tokenToHomeMs: number;
  apiCallsInFirst10s: number;
} {
  const submitToTokenMs =
    state.loginSubmitAt > 0 && state.tokenReceivedAt >= state.loginSubmitAt
      ? state.tokenReceivedAt - state.loginSubmitAt
      : -1;
  const tokenToHomeMs =
    state.tokenReceivedAt > 0 && state.homeVisibleAt >= state.tokenReceivedAt
      ? state.homeVisibleAt - state.tokenReceivedAt
      : -1;

  return {
    submitToTokenMs,
    tokenToHomeMs,
    apiCallsInFirst10s: state.apiCallsInFirst10s,
  };
}

