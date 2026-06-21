// Live privacy meter. Lockin's core promise is that camera frames never leave
// the device — so instead of just *claiming* it, we measure every outbound
// fetch this page makes, tally the bytes, and classify them. The panel can then
// show, in real time, that video/image upload = 0 B while only tiny JSON label
// batches go out. It's a verifiable proof, not marketing copy.

export interface PrivacyStat {
  requests: number; // total outbound requests observed
  bytes: number; // total request-body bytes sent
  mediaBytes: number; // bytes whose payload was image/video (should stay 0)
  mediaRequests: number;
  labelBytes: number; // bytes sent to our /api/signals label endpoint
  labelRequests: number;
}

type Listener = (s: PrivacyStat) => void;

const listeners = new Set<Listener>();
let original: typeof fetch | null = null;
let stat: PrivacyStat = blank();

function blank(): PrivacyStat {
  return {
    requests: 0,
    bytes: 0,
    mediaBytes: 0,
    mediaRequests: 0,
    labelBytes: 0,
    labelRequests: 0,
  };
}

function emit() {
  const snapshot = { ...stat };
  listeners.forEach((l) => l(snapshot));
}

// Best-effort byte size of a fetch body. Our own payloads are JSON strings.
function bodyBytes(body: BodyInit | null | undefined): number {
  if (body == null) return 0;
  try {
    if (typeof body === "string") return new TextEncoder().encode(body).length;
    if (body instanceof Blob) return body.size;
    if (body instanceof ArrayBuffer) return body.byteLength;
    if (ArrayBuffer.isView(body)) return body.byteLength;
    if (body instanceof URLSearchParams)
      return new TextEncoder().encode(body.toString()).length;
  } catch {
    /* fall through */
  }
  return 0; // FormData/streams — size unknown; counted as a request only.
}

// Is this payload image/video/raw-frame data? (What must never be uploaded.)
function looksLikeMedia(body: BodyInit | null | undefined, ct: string): boolean {
  if (body instanceof Blob && /^(image|video)\//.test(body.type)) return true;
  return (
    /^(image|video)\//.test(ct) || ct === "application/octet-stream"
  );
}

function contentType(input: RequestInfo | URL, init?: RequestInit): string {
  const h = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  if (!h) return "";
  try {
    const headers = new Headers(h);
    return (headers.get("content-type") ?? "").toLowerCase();
  } catch {
    return "";
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return "";
}

/** Begin observing outbound fetches. Idempotent. */
export function startPrivacyMonitor(): void {
  if (original || typeof window === "undefined") return;
  original = window.fetch.bind(window);
  const orig = original;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const body =
        init?.body ?? (input instanceof Request ? null : undefined);
      const bytes = bodyBytes(body ?? undefined);
      const url = urlOf(input);
      const ct = contentType(input, init);
      stat.requests += 1;
      stat.bytes += bytes;
      if (looksLikeMedia(body ?? undefined, ct)) {
        stat.mediaBytes += bytes;
        stat.mediaRequests += 1;
      }
      if (url.includes("/api/signals")) {
        stat.labelBytes += bytes;
        stat.labelRequests += 1;
      }
      emit();
    } catch {
      /* never let measurement break a real request */
    }
    return orig(input as RequestInfo, init);
  };
}

/** Stop observing and restore the native fetch. */
export function stopPrivacyMonitor(): void {
  if (original && typeof window !== "undefined") {
    window.fetch = original;
  }
  original = null;
}

export function resetPrivacyStat(): void {
  stat = blank();
  emit();
}

export function getPrivacyStat(): PrivacyStat {
  return { ...stat };
}

export function subscribePrivacy(l: Listener): () => void {
  listeners.add(l);
  l({ ...stat });
  return () => listeners.delete(l);
}
