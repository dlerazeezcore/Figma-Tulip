import { getApiBaseCandidates } from "./config";
import { clearAuthSession, getAuthToken } from "./session";
import type { ApiResponse, AnyRecord } from "./types";

interface RequestOptions {
  method?: string;
  body?: AnyRecord | FormData | string | null;
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | null | undefined>;
  includeAuth?: boolean;
  baseCandidates?: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
}

let preferredApiBase = "";

function isAdminApiPath(path: string): boolean {
  const normalized = String(path || "").trim().toLowerCase();
  return normalized.startsWith("/admin/") || normalized.startsWith("/api/v1/admin/");
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = String(base || "").replace(/\/$/, "");
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${path}`;

  // Guard against accidental double-versioned routes, e.g.
  // base ".../api/v1" + path "/api/v1/auth/..." -> ".../api/v1/auth/..."
  const baseLower = normalizedBase.toLowerCase();
  const pathLower = normalizedPath.toLowerCase();
  if (baseLower.endsWith("/api/v1") && (pathLower === "/api/v1" || pathLower.startsWith("/api/v1/"))) {
    const suffix = normalizedPath.slice("/api/v1".length);
    return `${normalizedBase}${suffix || ""}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}

function withQuery(url: string, query?: RequestOptions["query"]): string {
  if (!query) {
    return url;
  }

  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    search.set(key, String(value));
  });

  const suffix = search.toString();
  return suffix ? `${url}?${suffix}` : url;
}

function parseError(payload: any, fallback: string): string {
  if (typeof payload === "string") {
    const text = payload.trim();
    if (text) {
      if (text.toLowerCase() === "unauthorized") {
        return "Unauthorized";
      }
      return text;
    }
  }

  if (payload && typeof payload === "object") {
    const detail = (payload as AnyRecord).detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const joined = detail
        .map((entry) => {
          if (typeof entry === "string") {
            return entry.trim();
          }
          if (entry && typeof entry === "object") {
            const msg = String((entry as AnyRecord).msg || (entry as AnyRecord).message || "").trim();
            if (msg) {
              return msg;
            }
          }
          return "";
        })
        .filter(Boolean)
        .join("; ");

      if (joined) {
        return joined;
      }
    }

    if (detail && typeof detail === "object") {
      const nested = String((detail as AnyRecord).msg || (detail as AnyRecord).message || "").trim();
      if (nested) {
        return nested;
      }
    }

    const direct = String(payload.detail || payload.error || payload.message || "").trim();
    if (direct) {
      return direct;
    }
  }
  return fallback;
}

function isApiEnvelope(value: any): value is ApiResponse {
  return Boolean(value && typeof value === "object" && typeof value.success === "boolean");
}

function dedupeBases(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  });

  return out;
}

export async function requestApi<T = any>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const adminRoute = isAdminApiPath(path);
  const authToken = String(getAuthToken() || "").trim();

  // Never send /admin API requests without a bearer token.
  if (adminRoute && !authToken) {
    return { success: false, error: "Unauthorized. Please log in as admin." };
  }

  const hasCustomBaseCandidates = Boolean(options.baseCandidates && options.baseCandidates.length > 0);

  const configuredCandidates = (hasCustomBaseCandidates
    ? options.baseCandidates
    : getApiBaseCandidates()
  ).filter(Boolean);

  const attempts = hasCustomBaseCandidates
    ? dedupeBases(configuredCandidates.length > 0 ? configuredCandidates : [""])
    : dedupeBases([
        preferredApiBase,
        ...(configuredCandidates.length > 0 ? configuredCandidates : [""]),
      ]);

  let lastError = "Request failed";

  for (let index = 0; index < attempts.length; index += 1) {
    const base = attempts[index];
    const url = withQuery(joinUrl(base, path), options.query);

    const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers: HeadersInit = isFormDataBody
      ? { ...(options.headers || {}) }
      : {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        };

    if ((options.includeAuth !== false || adminRoute) && authToken) {
      (headers as Record<string, string>).Authorization = `Bearer ${authToken}`;
    }

    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Math.max(0, Number(options.timeoutMs)) : 20000;
    const externalSignal = options.signal;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let removeExternalAbortListener: (() => void) | null = null;
    if (controller && externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        const handleExternalAbort = () => controller.abort();
        externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
        removeExternalAbortListener = () => {
          externalSignal.removeEventListener("abort", handleExternalAbort);
        };
      }
    }
    const timeoutId =
      controller && timeoutMs > 0
        ? setTimeout(() => {
            controller.abort();
          }, timeoutMs)
        : null;

    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        signal: controller?.signal ?? externalSignal,
        body:
          options.body === undefined || options.body === null
            ? undefined
            : isFormDataBody
            ? options.body
            : typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body),
      });
      const rawText = await response.text();
      let payload: any = null;
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      const isJsonResponse = contentType.includes("application/json") || contentType.includes("+json");

      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = rawText;
        }
      }

      if (response.ok) {
        const isHtmlPayload =
          typeof payload === "string" &&
          /<!doctype html|<html[\s>]/i.test(payload.slice(0, 300));

        // Some hosts rewrite unknown /api/* paths to index.html with HTTP 200.
        // Treat HTML/non-JSON as invalid API payload and try the next base candidate.
        if ((!isJsonResponse || isHtmlPayload) && index < attempts.length - 1) {
          lastError = "Received non-JSON response from API base";
          continue;
        }

        if (!isJsonResponse && isHtmlPayload) {
          return {
            success: false,
            error: "API base returned HTML instead of JSON. Please check backend base URL/proxy.",
          };
        }

        if (!hasCustomBaseCandidates && base && base !== preferredApiBase) {
          preferredApiBase = base;
        }
        if (isApiEnvelope(payload)) {
          return {
            ...(payload as ApiResponse<T>),
            statusCode: (payload as ApiResponse<T>).statusCode ?? response.status,
          };
        }
        return { success: true, data: payload as T, statusCode: response.status };
      }

      const errorMessage = parseError(payload, `Request failed with status ${response.status}`);
      if (
        response.status === 401 &&
        options.includeAuth !== false &&
        authToken
      ) {
        clearAuthSession();
      }

      // Retry on likely routing/base-url mismatch before failing.
      const shouldTryNext =
        index < attempts.length - 1 &&
        [404, 405, 502, 503, 504].includes(response.status);

      if (shouldTryNext) {
        lastError = errorMessage;
        continue;
      }

      return { success: false, error: errorMessage, statusCode: response.status };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        lastError = externalSignal?.aborted
          ? "Request aborted"
          : `Request timed out after ${Math.round(timeoutMs / 1000)}s`;
      } else {
        lastError = error instanceof Error ? error.message : "Network error";
      }
      if (index < attempts.length - 1) {
        continue;
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (removeExternalAbortListener) {
        removeExternalAbortListener();
      }
    }
  }

  return { success: false, error: lastError };
}
