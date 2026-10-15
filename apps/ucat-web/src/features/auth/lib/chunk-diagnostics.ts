/** Self-contained: this runs before the SDK and must survive missing React chunks. */
export const CHUNK_DIAGNOSTIC_BOOTSTRAP = String.raw`(function () {
  var records = [];
  var storageKey = 'ucat-chunk-diagnostics';
  var carried = false;
  var lifetime = 300000;
  window.__ucatChunkDiagnostics = { records: records };

  function allowed() {
    var value = window.location.href;
    for (var depth = 0; depth < 5; depth++) {
      if (/\/(?:mobile-auth|mobile-browser)(?=[/?#\s"'&]|$)|\/api\/auth\/(?:native|browser)\/(?:ticket|exchange)(?=[/?#\s"'&]|$)/.test(value)) return false;
      try {
        var decoded = decodeURIComponent(value);
        if (decoded === value) break;
        value = decoded;
      } catch (_) {
        value = value.replace(/%[0-9a-f]{2}/gi, function (escape) { return String.fromCharCode(parseInt(escape.slice(1), 16)); });
      }
    }
    return true;
  }

  function chunkName(source) {
    try {
      var url = new URL(source, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.indexOf('/_next/static/chunks/') !== 0) return;
      var match = url.pathname.match(/\/([a-z0-9_-]+-[a-f0-9]{8,64}\.js)$/i);
      return match && match[1].length <= 160 ? match[1] : undefined;
    } catch (_) { return; }
  }

  function number(value, maximum) {
    return typeof value === 'number' && isFinite(value) && value >= 0 && value <= maximum ? Math.round(value) : undefined;
  }

  function navigation() {
    try {
      var entries = performance.getEntriesByType('navigation');
      var type = entries[0] && entries[0].type;
      return type === 'navigate' || type === 'reload' || type === 'back_forward' ? type : 'unknown';
    } catch (_) { return 'unknown'; }
  }

  function timing(source) {
    var result = { responseStatus: null };
    try {
      var entries = performance.getEntriesByName(source, 'resource');
      var entry = entries[entries.length - 1];
      if (!entry) return result;
      var status = entry.responseStatus;
      if (typeof status === 'number' && status >= 100 && status <= 599 && Math.floor(status) === status) result.responseStatus = status;
      var fields = [['duration', 'durationMs', 3600000], ['transferSize', 'transferBytes', 104857600], ['encodedBodySize', 'encodedBytes', 104857600], ['decodedBodySize', 'decodedBytes', 104857600]];
      fields.forEach(function (field) {
        var value = number(entry[field[0]], field[2]);
        if (value !== undefined) result[field[1]] = value;
      });
      result.transferHint = result.transferBytes > 0 ? 'transferred' : result.transferBytes === 0 && result.encodedBytes > 0 ? 'no-transfer' : 'unknown';
    } catch (_) { /* Timing support and access vary by browser. */ }
    return result;
  }

  function clean(input) {
    if (!input || typeof input !== 'object') return;
    if (['resource-error', 'chunk-error', 'unhandled-rejection', 'react-hydration', 'auto-reload', 'fallback', 'manual-retry'].indexOf(input.kind) < 0) return;
    if (typeof input.at !== 'number' || !isFinite(input.at) || input.at > Date.now() || input.at < Date.now() - lifetime) return;
    var result = { kind: input.kind, at: input.at, online: ['online', 'offline'].indexOf(input.online) >= 0 ? input.online : 'unknown', visibility: ['visible', 'hidden'].indexOf(input.visibility) >= 0 ? input.visibility : 'unknown', navigation: ['navigate', 'reload', 'back_forward'].indexOf(input.navigation) >= 0 ? input.navigation : 'unknown' };
    if (typeof input.chunk === 'string' && /^[a-z0-9_-]+-[a-f0-9]{8,64}\.js$/i.test(input.chunk) && input.chunk.length <= 160) {
      result.chunk = input.chunk;
      var raw = input.timing;
      if (raw && typeof raw === 'object') {
        var timing = { responseStatus: typeof raw.responseStatus === 'number' && raw.responseStatus >= 100 && raw.responseStatus <= 599 && Math.floor(raw.responseStatus) === raw.responseStatus ? raw.responseStatus : null };
        ['durationMs', 'transferBytes', 'encodedBytes', 'decodedBytes'].forEach(function (field) {
          var value = number(raw[field], field === 'durationMs' ? 3600000 : 104857600);
          if (value !== undefined) timing[field] = value;
        });
        timing.transferHint = timing.transferBytes > 0 ? 'transferred' : timing.transferBytes === 0 && timing.encodedBytes > 0 ? 'no-transfer' : 'unknown';
        result.timing = timing;
      }
    }
    if (['418', '419', '422', '423', '425'].indexOf(input.reactCode) >= 0) result.reactCode = input.reactCode;
    return result;
  }

  try {
    var previous = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    if (allowed() && previous && previous.length <= 4096) {
      var parsed = JSON.parse(previous);
      if (parsed.version === 1 && parsed.carry === 1 && typeof parsed.savedAt === 'number' && parsed.savedAt <= Date.now() && parsed.savedAt >= Date.now() - lifetime && Array.isArray(parsed.records)) {
        carried = true;
        parsed.records.slice(-6).forEach(function (entry) { var value = clean(entry); if (value) records.push(value); });
      }
    }
  } catch (_) { /* Collection is optional when browser storage is blocked. */ }

  function persist() {
    if (carried || !allowed()) return;
    try {
      var value = JSON.stringify({ version: 1, carry: 1, savedAt: Date.now(), records: records.map(clean).filter(Boolean).slice(-6) });
      if (value.length <= 4096) sessionStorage.setItem(storageKey, value);
    } catch (_) { /* Never interfere with the existing reload guard. */ }
  }

  function record(kind, source, reactCode) {
    if (!allowed()) return;
    var entry = { kind: kind, at: Date.now(), online: navigator.onLine === true ? 'online' : navigator.onLine === false ? 'offline' : 'unknown', visibility: document.visibilityState === 'visible' ? 'visible' : document.visibilityState === 'hidden' ? 'hidden' : 'unknown' };
    var chunk = chunkName(source);
    entry.navigation = navigation();
    if (chunk) { entry.chunk = chunk; entry.timing = timing(source); }
    if (reactCode) entry.reactCode = reactCode;
    records.push(entry);
    if (records.length > 6) records.shift();
    window.dispatchEvent(new Event('ucat-chunk-diagnostic'));
  }

  function error(kind, value) {
    if (!value) return;
    var message = typeof value.message === 'string' ? value.message : '';
    if (value.name === 'ChunkLoadError' || /Loading chunk [^ ]+ failed/.test(message)) record(kind, value.request);
    var code = message.match(/(?:Minified React error #|react\.dev\/errors\/|invariant=)(418|419|422|423|425)(?:\D|$)/);
    if (code) record('react-hydration', undefined, code[1]);
  }

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target instanceof HTMLScriptElement && chunkName(target.src)) record('resource-error', target.src);
    else error('chunk-error', event.error);
  }, true);
  window.addEventListener('unhandledrejection', function (event) { error('unhandled-rejection', event.reason); });
  return { record: record, persist: persist };
})()`;

import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { isMobileAuthBrowserContext } from "@/lib/privacy/mobile-auth-telemetry";

const LIFETIME_MS = 300_000;
const CHUNK_NAME = /^[a-z0-9_-]+-[a-f0-9]{8,64}\.js$/i;
const KINDS = [
  "resource-error",
  "chunk-error",
  "unhandled-rejection",
  "react-hydration",
  "auto-reload",
  "fallback",
  "manual-retry",
] as const;
const REACT_CODES = ["418", "419", "422", "423", "425"];

declare global {
  interface Window {
    __ucatChunkDiagnostics?: unknown;
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function boundedNumber(value: unknown, maximum: number): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= maximum
    ? Math.round(value)
    : undefined;
}

function cleanRecord(value: unknown, now: number) {
  const raw = object(value);
  if (
    !raw ||
    !KINDS.some((kind) => kind === raw.kind) ||
    typeof raw.at !== "number" ||
    !Number.isFinite(raw.at) ||
    raw.at > now ||
    raw.at < now - LIFETIME_MS
  )
    return;
  const record: Record<string, unknown> = {
    kind: raw.kind,
    at: raw.at,
    online:
      raw.online === "online" || raw.online === "offline"
        ? raw.online
        : "unknown",
    visibility:
      raw.visibility === "visible" || raw.visibility === "hidden"
        ? raw.visibility
        : "unknown",
    navigation:
      typeof raw.navigation === "string" &&
      ["navigate", "reload", "back_forward"].includes(raw.navigation)
        ? raw.navigation
        : "unknown",
  };
  if (
    typeof raw.chunk === "string" &&
    raw.chunk.length <= 160 &&
    CHUNK_NAME.test(raw.chunk)
  ) {
    record.chunk = raw.chunk;
    const rawTiming = object(raw.timing);
    if (rawTiming) {
      const timing: Record<string, number | string | null> = {
        responseStatus:
          typeof rawTiming.responseStatus === "number" &&
          Number.isInteger(rawTiming.responseStatus) &&
          rawTiming.responseStatus >= 100 &&
          rawTiming.responseStatus <= 599
            ? rawTiming.responseStatus
            : null,
      };
      for (const field of [
        "durationMs",
        "transferBytes",
        "encodedBytes",
        "decodedBytes",
      ]) {
        const number = boundedNumber(
          rawTiming[field],
          field === "durationMs" ? 3_600_000 : 104_857_600,
        );
        if (number !== undefined) timing[field] = number;
      }
      timing.transferHint =
        typeof timing.transferBytes === "number" && timing.transferBytes > 0
          ? "transferred"
          : timing.transferBytes === 0 &&
              typeof timing.encodedBytes === "number" &&
              timing.encodedBytes > 0
            ? "no-transfer"
            : "unknown";
      record.timing = timing;
    }
  }
  if (typeof raw.reactCode === "string" && REACT_CODES.includes(raw.reactCode))
    record.reactCode = raw.reactCode;
  return record;
}

/** Revalidate the native queue: browser globals and session storage are untrusted. */
export function readChunkDiagnostics() {
  try {
    if (typeof window === "undefined" || isMobileAuthBrowserContext()) return;
    const raw = object(window.__ucatChunkDiagnostics);
    if (!Array.isArray(raw?.records)) return;
    const now = Date.now();
    const records = raw.records
      .slice(-6)
      .map((record) => cleanRecord(record, now))
      .filter((record): record is Record<string, unknown> => !!record);
    if (!records.length) return;
    const context = { records };
    return JSON.stringify(context).length <= 4096 ? context : undefined;
  } catch {
    return;
  }
}

export function attachChunkDiagnostics(event: ErrorEvent): ErrorEvent {
  const relevant = event.exception?.values?.some(
    (exception) =>
      exception.type === "ChunkLoadError" ||
      /Loading chunk [^ ]+ failed|(?:Minified React error #|react\.dev\/errors\/|invariant=)(?:418|419|422|423|425)(?:\D|$)|does not match server-rendered HTML|Hydration failed because/i.test(
        exception.value ?? "",
      ),
  );
  if (!relevant) return event;
  const context = readChunkDiagnostics();
  return context
    ? {
        ...event,
        contexts: { ...event.contexts, ucat_chunk_diagnostics: context },
      }
    : event;
}

/** Breadcrumbs enrich existing replay/error sessions; this never captures an error. */
export function forwardChunkDiagnosticBreadcrumbs(
  addBreadcrumb: (breadcrumb: Breadcrumb) => void,
) {
  let last: string | undefined;
  const publish = (record: Record<string, unknown>) => {
    const key = JSON.stringify(record);
    if (key === last) return;
    last = key;
    addBreadcrumb({
      category: "ucat.chunk",
      level: "info",
      timestamp: Number(record.at) / 1000,
      data: record,
    });
  };
  readChunkDiagnostics()?.records.forEach(publish);
  const listener = () => {
    const record = readChunkDiagnostics()?.records.at(-1);
    if (record) publish(record);
  };
  window.addEventListener("ucat-chunk-diagnostic", listener);
  return () => window.removeEventListener("ucat-chunk-diagnostic", listener);
}

/** Replay derives its Hydration Error issue from this marker, outside error beforeSend. */
export function attachChunkDiagnosticsToReplay<T>(event: T): T {
  const raw = object(event);
  const data = object(raw?.data);
  const payload = object(data?.payload);
  if (
    raw?.type !== 5 ||
    data?.tag !== "breadcrumb" ||
    payload?.category !== "replay.hydrate-error"
  )
    return event;
  const context = readChunkDiagnostics();
  if (!context) return event;
  return {
    ...raw,
    data: {
      ...data,
      payload: {
        ...payload,
        data: { ...object(payload.data), ucat_chunk_diagnostics: context },
      },
    },
  } as T;
}
