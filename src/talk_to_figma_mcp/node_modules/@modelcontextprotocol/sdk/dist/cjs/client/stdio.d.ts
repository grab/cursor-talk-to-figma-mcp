import { IOType } from "node:child_process";
import { Stream } from "node:stream";
import { Transport } from "../shared/transport.js";
import { JSONRPCMessage } from "../types.js";
export type StdioServerParameters = {
    /**
     * The executable to run to start the server.
     */
    command: string;
    /**
     * Command line arguments to pass to the executable.
     */
    args?: string[];
    /**
     * The environment to use when spawning the process.
     *
     * If not specified, the result of getDefaultEnvironment() will be used.
     */
    env?: Record<string, string>;
    /**
     * How to handle stderr of the child process. This matches the semantics of Node's `child_process.spawn`.
     *
     * The default is "inherit", meaning messages to stderr will be printed to the parent process's stderr.
     */
    stderr?: IOType | Stream | number;
    /**
     * The working directory to use when spawning the process.
     *
     * If not specified, the current working directory will be inherited.
     */
    cwd?: string;
};
/**
 * Environment variables to inherit by default, if an environment is not explicitly given.
 */
export declare const DEFAULT_INHERITED_ENV_VARS: string[];
/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
export declare function getDefaultEnvironment(): Record<string, string>;
/**
 * Client transport for stdio: this will connect to a server by spawning a process and communicating with it over stdin/stdout.
 *
 * This transport is only available in Node.js environments.
 */
export declare class StdioClientTransport implements Transport {
    private _process?;
    private _abortController;
    private _readBuffer;
    private _serverParams;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;
    constructor(server: StdioServerParameters);
    /**
     * Starts the server process and prepares to communicate with it.
     */
    start(): Promise<void>;
    /**
     * The stderr stream of the child process, if `StdioServerParameters.stderr` was set to "pipe" or "overlapped".
     *
     * This is only available after the process has been started.
     */
    get stderr(): Stream | null;
    private processReadBuffer;
    close(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
}
//# sourceMappingURL=stdio.d.ts.map