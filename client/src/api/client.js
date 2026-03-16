function getStatusMessage(status) {
    if (status === 400) {
        return "Invalid request. Please check your input and try again.";
    }
    if (status === 401) {
        return "Your session is not authorized. Please sign in again.";
    }
    if (status === 403) {
        return "You do not have permission to perform this action.";
    }
    if (status === 404) {
        return "The requested item was not found.";
    }
    if (status === 429) {
        return "Too many requests. Please wait a moment and retry.";
    }
    if (status >= 500) {
        return "Server error occurred. Please retry shortly.";
    }
    return `Request failed: ${status}`;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const externalSignal = init.signal;

    if (externalSignal?.aborted) {
        controller.abort(externalSignal.reason);
    }

    const forwardAbort = () => {
        controller.abort(externalSignal.reason);
    };

    if (externalSignal) {
        externalSignal.addEventListener("abort", forwardAbort, { once: true });
    }

    const timer = window.setTimeout(() => {
        controller.abort("timeout");
    }, timeoutMs);

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            const reason = controller.signal.reason;
            if (reason === "timeout") {
                throw new Error("Request timed out. Please check your connection and retry.");
            }
            throw new Error("Request cancelled.");
        }

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            throw new Error("You appear to be offline. Reconnect to the internet and try again.");
        }

        if (error instanceof TypeError) {
            throw new Error("Unable to reach the server. Please check your connection and retry.");
        }

        throw error;
    } finally {
        window.clearTimeout(timer);
        if (externalSignal) {
            externalSignal.removeEventListener("abort", forwardAbort);
        }
    }
}

async function requestJSON(url, init = {}, options = {}) {
    const res = await fetchWithTimeout(url, init, options.timeoutMs ?? 15000);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || getStatusMessage(res.status));
    }
    return res.json();
}

export async function getJSON(url, options = {}) {
    return requestJSON(url, { method: "GET", signal: options.signal }, options);
}

export async function postJSON(url, payload = {}, options = {}) {
    return requestJSON(
        url,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: options.signal,
        },
        options
    );
}

export async function patchJSON(url, payload, options = {}) {
    return requestJSON(
        url,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: options.signal,
        },
        options
    );
}
