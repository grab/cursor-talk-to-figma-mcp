"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryTransport = void 0;
/**
 * In-memory transport for creating clients and servers that talk to each other within the same process.
 */
class InMemoryTransport {
    constructor() {
        this._messageQueue = [];
    }
    /**
     * Creates a pair of linked in-memory transports that can communicate with each other. One should be passed to a Client and one to a Server.
     */
    static createLinkedPair() {
        const clientTransport = new InMemoryTransport();
        const serverTransport = new InMemoryTransport();
        clientTransport._otherTransport = serverTransport;
        serverTransport._otherTransport = clientTransport;
        return [clientTransport, serverTransport];
    }
    async start() {
        var _a;
        // Process any messages that were queued before start was called
        while (this._messageQueue.length > 0) {
            const message = this._messageQueue.shift();
            if (message) {
                (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, message);
            }
        }
    }
    async close() {
        var _a;
        const other = this._otherTransport;
        this._otherTransport = undefined;
        await (other === null || other === void 0 ? void 0 : other.close());
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    async send(message) {
        if (!this._otherTransport) {
            throw new Error("Not connected");
        }
        if (this._otherTransport.onmessage) {
            this._otherTransport.onmessage(message);
        }
        else {
            this._otherTransport._messageQueue.push(message);
        }
    }
}
exports.InMemoryTransport = InMemoryTransport;
//# sourceMappingURL=inMemory.js.map