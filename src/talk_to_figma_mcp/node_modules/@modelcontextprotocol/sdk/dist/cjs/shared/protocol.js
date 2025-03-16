"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Protocol = exports.DEFAULT_REQUEST_TIMEOUT_MSEC = void 0;
exports.mergeCapabilities = mergeCapabilities;
const types_js_1 = require("../types.js");
/**
 * The default request timeout, in miliseconds.
 */
exports.DEFAULT_REQUEST_TIMEOUT_MSEC = 60000;
/**
 * Implements MCP protocol framing on top of a pluggable transport, including
 * features like request/response linking, notifications, and progress.
 */
class Protocol {
    constructor(_options) {
        this._options = _options;
        this._requestMessageId = 0;
        this._requestHandlers = new Map();
        this._requestHandlerAbortControllers = new Map();
        this._notificationHandlers = new Map();
        this._responseHandlers = new Map();
        this._progressHandlers = new Map();
        this._timeoutInfo = new Map();
        this.setNotificationHandler(types_js_1.CancelledNotificationSchema, (notification) => {
            const controller = this._requestHandlerAbortControllers.get(notification.params.requestId);
            controller === null || controller === void 0 ? void 0 : controller.abort(notification.params.reason);
        });
        this.setNotificationHandler(types_js_1.ProgressNotificationSchema, (notification) => {
            this._onprogress(notification);
        });
        this.setRequestHandler(types_js_1.PingRequestSchema, 
        // Automatic pong by default.
        (_request) => ({}));
    }
    _setupTimeout(messageId, timeout, maxTotalTimeout, onTimeout) {
        this._timeoutInfo.set(messageId, {
            timeoutId: setTimeout(onTimeout, timeout),
            startTime: Date.now(),
            timeout,
            maxTotalTimeout,
            onTimeout
        });
    }
    _resetTimeout(messageId) {
        const info = this._timeoutInfo.get(messageId);
        if (!info)
            return false;
        const totalElapsed = Date.now() - info.startTime;
        if (info.maxTotalTimeout && totalElapsed >= info.maxTotalTimeout) {
            this._timeoutInfo.delete(messageId);
            throw new types_js_1.McpError(types_js_1.ErrorCode.RequestTimeout, "Maximum total timeout exceeded", { maxTotalTimeout: info.maxTotalTimeout, totalElapsed });
        }
        clearTimeout(info.timeoutId);
        info.timeoutId = setTimeout(info.onTimeout, info.timeout);
        return true;
    }
    _cleanupTimeout(messageId) {
        const info = this._timeoutInfo.get(messageId);
        if (info) {
            clearTimeout(info.timeoutId);
            this._timeoutInfo.delete(messageId);
        }
    }
    /**
     * Attaches to the given transport, starts it, and starts listening for messages.
     *
     * The Protocol object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
     */
    async connect(transport) {
        this._transport = transport;
        this._transport.onclose = () => {
            this._onclose();
        };
        this._transport.onerror = (error) => {
            this._onerror(error);
        };
        this._transport.onmessage = (message) => {
            if (!("method" in message)) {
                this._onresponse(message);
            }
            else if ("id" in message) {
                this._onrequest(message);
            }
            else {
                this._onnotification(message);
            }
        };
        await this._transport.start();
    }
    _onclose() {
        var _a;
        const responseHandlers = this._responseHandlers;
        this._responseHandlers = new Map();
        this._progressHandlers.clear();
        this._transport = undefined;
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
        const error = new types_js_1.McpError(types_js_1.ErrorCode.ConnectionClosed, "Connection closed");
        for (const handler of responseHandlers.values()) {
            handler(error);
        }
    }
    _onerror(error) {
        var _a;
        (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
    }
    _onnotification(notification) {
        var _a;
        const handler = (_a = this._notificationHandlers.get(notification.method)) !== null && _a !== void 0 ? _a : this.fallbackNotificationHandler;
        // Ignore notifications not being subscribed to.
        if (handler === undefined) {
            return;
        }
        // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
        Promise.resolve()
            .then(() => handler(notification))
            .catch((error) => this._onerror(new Error(`Uncaught error in notification handler: ${error}`)));
    }
    _onrequest(request) {
        var _a, _b, _c;
        const handler = (_a = this._requestHandlers.get(request.method)) !== null && _a !== void 0 ? _a : this.fallbackRequestHandler;
        if (handler === undefined) {
            (_b = this._transport) === null || _b === void 0 ? void 0 : _b.send({
                jsonrpc: "2.0",
                id: request.id,
                error: {
                    code: types_js_1.ErrorCode.MethodNotFound,
                    message: "Method not found",
                },
            }).catch((error) => this._onerror(new Error(`Failed to send an error response: ${error}`)));
            return;
        }
        const abortController = new AbortController();
        this._requestHandlerAbortControllers.set(request.id, abortController);
        // Create extra object with both abort signal and sessionId from transport
        const extra = {
            signal: abortController.signal,
            sessionId: (_c = this._transport) === null || _c === void 0 ? void 0 : _c.sessionId,
        };
        // Starting with Promise.resolve() puts any synchronous errors into the monad as well.
        Promise.resolve()
            .then(() => handler(request, extra))
            .then((result) => {
            var _a;
            if (abortController.signal.aborted) {
                return;
            }
            return (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                result,
                jsonrpc: "2.0",
                id: request.id,
            });
        }, (error) => {
            var _a, _b;
            if (abortController.signal.aborted) {
                return;
            }
            return (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                jsonrpc: "2.0",
                id: request.id,
                error: {
                    code: Number.isSafeInteger(error["code"])
                        ? error["code"]
                        : types_js_1.ErrorCode.InternalError,
                    message: (_b = error.message) !== null && _b !== void 0 ? _b : "Internal error",
                },
            });
        })
            .catch((error) => this._onerror(new Error(`Failed to send response: ${error}`)))
            .finally(() => {
            this._requestHandlerAbortControllers.delete(request.id);
        });
    }
    _onprogress(notification) {
        const { progressToken, ...params } = notification.params;
        const messageId = Number(progressToken);
        const handler = this._progressHandlers.get(messageId);
        if (!handler) {
            this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(notification)}`));
            return;
        }
        const responseHandler = this._responseHandlers.get(messageId);
        if (this._timeoutInfo.has(messageId) && responseHandler) {
            try {
                this._resetTimeout(messageId);
            }
            catch (error) {
                responseHandler(error);
                return;
            }
        }
        handler(params);
    }
    _onresponse(response) {
        const messageId = Number(response.id);
        const handler = this._responseHandlers.get(messageId);
        if (handler === undefined) {
            this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(response)}`));
            return;
        }
        this._responseHandlers.delete(messageId);
        this._progressHandlers.delete(messageId);
        this._cleanupTimeout(messageId);
        if ("result" in response) {
            handler(response);
        }
        else {
            const error = new types_js_1.McpError(response.error.code, response.error.message, response.error.data);
            handler(error);
        }
    }
    get transport() {
        return this._transport;
    }
    /**
     * Closes the connection.
     */
    async close() {
        var _a;
        await ((_a = this._transport) === null || _a === void 0 ? void 0 : _a.close());
    }
    /**
     * Sends a request and wait for a response.
     *
     * Do not use this method to emit notifications! Use notification() instead.
     */
    request(request, resultSchema, options) {
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d;
            if (!this._transport) {
                reject(new Error("Not connected"));
                return;
            }
            if (((_a = this._options) === null || _a === void 0 ? void 0 : _a.enforceStrictCapabilities) === true) {
                this.assertCapabilityForMethod(request.method);
            }
            (_b = options === null || options === void 0 ? void 0 : options.signal) === null || _b === void 0 ? void 0 : _b.throwIfAborted();
            const messageId = this._requestMessageId++;
            const jsonrpcRequest = {
                ...request,
                jsonrpc: "2.0",
                id: messageId,
            };
            if (options === null || options === void 0 ? void 0 : options.onprogress) {
                this._progressHandlers.set(messageId, options.onprogress);
                jsonrpcRequest.params = {
                    ...request.params,
                    _meta: { progressToken: messageId },
                };
            }
            const cancel = (reason) => {
                var _a;
                this._responseHandlers.delete(messageId);
                this._progressHandlers.delete(messageId);
                this._cleanupTimeout(messageId);
                (_a = this._transport) === null || _a === void 0 ? void 0 : _a.send({
                    jsonrpc: "2.0",
                    method: "notifications/cancelled",
                    params: {
                        requestId: messageId,
                        reason: String(reason),
                    },
                }).catch((error) => this._onerror(new Error(`Failed to send cancellation: ${error}`)));
                reject(reason);
            };
            this._responseHandlers.set(messageId, (response) => {
                var _a;
                if ((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                    return;
                }
                if (response instanceof Error) {
                    return reject(response);
                }
                try {
                    const result = resultSchema.parse(response.result);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
            (_c = options === null || options === void 0 ? void 0 : options.signal) === null || _c === void 0 ? void 0 : _c.addEventListener("abort", () => {
                var _a;
                cancel((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.reason);
            });
            const timeout = (_d = options === null || options === void 0 ? void 0 : options.timeout) !== null && _d !== void 0 ? _d : exports.DEFAULT_REQUEST_TIMEOUT_MSEC;
            const timeoutHandler = () => cancel(new types_js_1.McpError(types_js_1.ErrorCode.RequestTimeout, "Request timed out", { timeout }));
            this._setupTimeout(messageId, timeout, options === null || options === void 0 ? void 0 : options.maxTotalTimeout, timeoutHandler);
            this._transport.send(jsonrpcRequest).catch((error) => {
                this._cleanupTimeout(messageId);
                reject(error);
            });
        });
    }
    /**
     * Emits a notification, which is a one-way message that does not expect a response.
     */
    async notification(notification) {
        if (!this._transport) {
            throw new Error("Not connected");
        }
        this.assertNotificationCapability(notification.method);
        const jsonrpcNotification = {
            ...notification,
            jsonrpc: "2.0",
        };
        await this._transport.send(jsonrpcNotification);
    }
    /**
     * Registers a handler to invoke when this protocol object receives a request with the given method.
     *
     * Note that this will replace any previous request handler for the same method.
     */
    setRequestHandler(requestSchema, handler) {
        const method = requestSchema.shape.method.value;
        this.assertRequestHandlerCapability(method);
        this._requestHandlers.set(method, (request, extra) => Promise.resolve(handler(requestSchema.parse(request), extra)));
    }
    /**
     * Removes the request handler for the given method.
     */
    removeRequestHandler(method) {
        this._requestHandlers.delete(method);
    }
    /**
     * Asserts that a request handler has not already been set for the given method, in preparation for a new one being automatically installed.
     */
    assertCanSetRequestHandler(method) {
        if (this._requestHandlers.has(method)) {
            throw new Error(`A request handler for ${method} already exists, which would be overridden`);
        }
    }
    /**
     * Registers a handler to invoke when this protocol object receives a notification with the given method.
     *
     * Note that this will replace any previous notification handler for the same method.
     */
    setNotificationHandler(notificationSchema, handler) {
        this._notificationHandlers.set(notificationSchema.shape.method.value, (notification) => Promise.resolve(handler(notificationSchema.parse(notification))));
    }
    /**
     * Removes the notification handler for the given method.
     */
    removeNotificationHandler(method) {
        this._notificationHandlers.delete(method);
    }
}
exports.Protocol = Protocol;
function mergeCapabilities(base, additional) {
    return Object.entries(additional).reduce((acc, [key, value]) => {
        if (value && typeof value === "object") {
            acc[key] = acc[key] ? { ...acc[key], ...value } : value;
        }
        else {
            acc[key] = value;
        }
        return acc;
    }, { ...base });
}
//# sourceMappingURL=protocol.js.map