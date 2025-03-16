import { Transport } from "./shared/transport.js";
import { JSONRPCMessage } from "./types.js";
/**
 * In-memory transport for creating clients and servers that talk to each other within the same process.
 */
export declare class InMemoryTransport implements Transport {
    private _otherTransport?;
    private _messageQueue;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;
    sessionId?: string;
    /**
     * Creates a pair of linked in-memory transports that can communicate with each other. One should be passed to a Client and one to a Server.
     */
    static createLinkedPair(): [InMemoryTransport, InMemoryTransport];
    start(): Promise<void>;
    close(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
}
//# sourceMappingURL=inMemory.d.ts.map