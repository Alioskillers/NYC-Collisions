// frontend/src/lib/api.js
export async function fetchJSON(url, opts = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 45000,
    signal, // optional external AbortSignal
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    // give abort a clear reason so callers can ignore it
    controller.abort("timeout");
  }, timeoutMs);

  // If caller passed a signal, link it to our controller
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException(signal.reason || "aborted", "AbortError");
    }
    const onAbort = () => controller.abort(signal.reason || "aborted");
    signal.addEventListener("abort", onAbort, { once: true });
    // Ensure we remove the listener after fetch finishes
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      return await res.json();
    } catch (e) {
      // Normalize abort errors to a readable message
      if (isAbortError(e)) {
        throw new Error(`aborted:${controller.signal.reason || "aborted"}`);
      }
      throw e;
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  } else {
    // No external signal case
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      return await res.json();
    } catch (e) {
      if (isAbortError(e)) {
        throw new Error(`aborted:${controller.signal.reason || "aborted"}`);
      }
      throw e;
    }
  }
}

function isAbortError(e) {
  // DOMException in browsers, TypeError in some fetch impls, normalize via message
  return (
    e?.name === "AbortError" ||
    String(e?.message || "").toLowerCase().includes("aborted")
  );
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}