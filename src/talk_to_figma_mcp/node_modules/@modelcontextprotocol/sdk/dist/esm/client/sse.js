import { EventSource } from "eventsource";
import { JSONRPCMessageSchema } from "../types.js";
import { auth, UnauthorizedError } from "./auth.js";
export class SseError extends Error {
    constructor(code, message, event) {
        super(`SSE error: ${message}`);
        this.code = code;
        this.event = event;
    }
}
/**
 * Client transport for SSE: this will connect to a server using Server-Sent Events for receiving
 * messages and make separate POST requests for sending messages.
 */
export class SSEClientTransport {
    constructor(url, opts) {
        this._url = url;
        this._eventSourceInit = opts === null || opts === void 0 ? void 0 : opts.eventSourceInit;
        this._requestInit = opts === null || opts === void 0 ? void 0 : opts.requestInit;
        this._authProvider = opts === null || opts === void 0 ? void 0 : opts.authProvider;
    }
    async _authThenStart() {
        var _a;
        if (!this._authProvider) {
            throw new UnauthorizedError("No auth provider");
        }
        let result;
        try {
            result = await auth(this._authProvider, { serverUrl: this._url });
        }
        catch (error) {
            (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            throw error;
        }
        if (result !== "AUTHORIZED") {
            throw new UnauthorizedError();
        }
        return await this._startOrAuth();
    }
    async _commonHeaders() {
        const headers = {};
        if (this._authProvider) {
            const tokens = await this._authProvider.tokens();
            if (tokens) {
                headers["Authorization"] = `Bearer ${tokens.access_token}`;
            }
        }
        return headers;
    }
    _startOrAuth() {
        return new Promise((resolve, reject) => {
            var _a;
            this._eventSource = new EventSource(this._url.href, (_a = this._eventSourceInit) !== null && _a !== void 0 ? _a : {
                fetch: (url, init) => this._commonHeaders().then((headers) => fetch(url, {
                    ...init,
                    headers: {
                        ...headers,
                        Accept: "text/event-stream"
                    }
                })),
            });
            this._abortController = new AbortController();
            this._eventSource.onerror = (event) => {
                var _a;
                if (event.code === 401 && this._authProvider) {
                    this._authThenStart().then(resolve, reject);
                    return;
                }
                const error = new SseError(event.code, event.message, event);
                reject(error);
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            };
            this._eventSource.onopen = () => {
                // The connection is open, but we need to wait for the endpoint to be received.
            };
            this._eventSource.addEventListener("endpoint", (event) => {
                var _a;
                const messageEvent = event;
                try {
                    this._endpoint = new URL(messageEvent.data, this._url);
                    if (this._endpoint.origin !== this._url.origin) {
                        throw new Error(`Endpoint origin does not match connection origin: ${this._endpoint.origin}`);
                    }
                }
                catch (error) {
                    reject(error);
                    (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
                    void this.close();
                    return;
                }
                resolve();
            });
            this._eventSource.onmessage = (event) => {
                var _a, _b;
                const messageEvent = event;
                let message;
                try {
                    message = JSONRPCMessageSchema.parse(JSON.parse(messageEvent.data));
                }
                catch (error) {
                    (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
                    return;
                }
                (_b = this.onmessage) === null || _b === void 0 ? void 0 : _b.call(this, message);
            };
        });
    }
    async start() {
        if (this._eventSource) {
            throw new Error("SSEClientTransport already started! If using Client class, note that connect() calls start() automatically.");
        }
        return await this._startOrAuth();
    }
    /**
     * Call this method after the user has finished authorizing via their user agent and is redirected back to the MCP client application. This will exchange the authorization code for an access token, enabling the next connection attempt to successfully auth.
     */
    async finishAuth(authorizationCode) {
        if (!this._authProvider) {
            throw new UnauthorizedError("No auth provider");
        }
        const result = await auth(this._authProvider, { serverUrl: this._url, authorizationCode });
        if (result !== "AUTHORIZED") {
            throw new UnauthorizedError("Failed to authorize");
        }
    }
    async close() {
        var _a, _b, _c;
        (_a = this._abortController) === null || _a === void 0 ? void 0 : _a.abort();
        (_b = this._eventSource) === null || _b === void 0 ? void 0 : _b.close();
        (_c = this.onclose) === null || _c === void 0 ? void 0 : _c.call(this);
    }
    async send(message) {
        var _a, _b, _c;
        if (!this._endpoint) {
            throw new Error("Not connected");
        }
        try {
            const commonHeaders = await this._commonHeaders();
            const headers = new Headers({ ...commonHeaders, ...(_a = this._requestInit) === null || _a === void 0 ? void 0 : _a.headers });
            headers.set("content-type", "application/json");
            const init = {
                ...this._requestInit,
                method: "POST",
                headers,
                body: JSON.stringify(message),
                signal: (_b = this._abortController) === null || _b === void 0 ? void 0 : _b.signal,
            };
            const response = await fetch(this._endpoint, init);
            if (!response.ok) {
                if (response.status === 401 && this._authProvider) {
                    const result = await auth(this._authProvider, { serverUrl: this._url });
                    if (result !== "AUTHORIZED") {
                        throw new UnauthorizedError();
                    }
                    // Purposely _not_ awaited, so we don't call onerror twice
                    return this.send(message);
                }
                const text = await response.text().catch(() => null);
                throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`);
            }
        }
        catch (error) {
            (_c = this.onerror) === null || _c === void 0 ? void 0 : _c.call(this, error);
            throw error;
        }
    }
}
//# sourceMappingURL=sse.js.map