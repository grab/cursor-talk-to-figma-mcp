"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StdioClientTransport = exports.DEFAULT_INHERITED_ENV_VARS = void 0;
exports.getDefaultEnvironment = getDefaultEnvironment;
const node_child_process_1 = require("node:child_process");
const node_process_1 = __importDefault(require("node:process"));
const stdio_js_1 = require("../shared/stdio.js");
/**
 * Environment variables to inherit by default, if an environment is not explicitly given.
 */
exports.DEFAULT_INHERITED_ENV_VARS = node_process_1.default.platform === "win32"
    ? [
        "APPDATA",
        "HOMEDRIVE",
        "HOMEPATH",
        "LOCALAPPDATA",
        "PATH",
        "PROCESSOR_ARCHITECTURE",
        "SYSTEMDRIVE",
        "SYSTEMROOT",
        "TEMP",
        "USERNAME",
        "USERPROFILE",
    ]
    : /* list inspired by the default env inheritance of sudo */
        ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"];
/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
function getDefaultEnvironment() {
    const env = {};
    for (const key of exports.DEFAULT_INHERITED_ENV_VARS) {
        const value = node_process_1.default.env[key];
        if (value === undefined) {
            continue;
        }
        if (value.startsWith("()")) {
            // Skip functions, which are a security risk.
            continue;
        }
        env[key] = value;
    }
    return env;
}
/**
 * Client transport for stdio: this will connect to a server by spawning a process and communicating with it over stdin/stdout.
 *
 * This transport is only available in Node.js environments.
 */
class StdioClientTransport {
    constructor(server) {
        this._abortController = new AbortController();
        this._readBuffer = new stdio_js_1.ReadBuffer();
        this._serverParams = server;
    }
    /**
     * Starts the server process and prepares to communicate with it.
     */
    async start() {
        if (this._process) {
            throw new Error("StdioClientTransport already started! If using Client class, note that connect() calls start() automatically.");
        }
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d, _e, _f;
            this._process = (0, node_child_process_1.spawn)(this._serverParams.command, (_a = this._serverParams.args) !== null && _a !== void 0 ? _a : [], {
                env: (_b = this._serverParams.env) !== null && _b !== void 0 ? _b : getDefaultEnvironment(),
                stdio: ["pipe", "pipe", (_c = this._serverParams.stderr) !== null && _c !== void 0 ? _c : "inherit"],
                shell: false,
                signal: this._abortController.signal,
                windowsHide: node_process_1.default.platform === "win32" && isElectron(),
                cwd: this._serverParams.cwd,
            });
            this._process.on("error", (error) => {
                var _a, _b;
                if (error.name === "AbortError") {
                    // Expected when close() is called.
                    (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
                    return;
                }
                reject(error);
                (_b = this.onerror) === null || _b === void 0 ? void 0 : _b.call(this, error);
            });
            this._process.on("spawn", () => {
                resolve();
            });
            this._process.on("close", (_code) => {
                var _a;
                this._process = undefined;
                (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
            });
            (_d = this._process.stdin) === null || _d === void 0 ? void 0 : _d.on("error", (error) => {
                var _a;
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            });
            (_e = this._process.stdout) === null || _e === void 0 ? void 0 : _e.on("data", (chunk) => {
                this._readBuffer.append(chunk);
                this.processReadBuffer();
            });
            (_f = this._process.stdout) === null || _f === void 0 ? void 0 : _f.on("error", (error) => {
                var _a;
                (_a = this.onerror) === null || _a === void 0 ? void 0 : _a.call(this, error);
            });
        });
    }
    /**
     * The stderr stream of the child process, if `StdioServerParameters.stderr` was set to "pipe" or "overlapped".
     *
     * This is only available after the process has been started.
     */
    get stderr() {
        var _a, _b;
        return (_b = (_a = this._process) === null || _a === void 0 ? void 0 : _a.stderr) !== null && _b !== void 0 ? _b : null;
    }
    processReadBuffer() {
        var _a, _b;
        while (true) {
            try {
                const message = this._readBuffer.readMessage();
                if (message === null) {
                    break;
                }
                (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, message);
            }
            catch (error) {
                (_b = this.onerror) === null || _b === void 0 ? void 0 : _b.call(this, error);
            }
        }
    }
    async close() {
        this._abortController.abort();
        this._process = undefined;
        this._readBuffer.clear();
    }
    send(message) {
        return new Promise((resolve) => {
            var _a;
            if (!((_a = this._process) === null || _a === void 0 ? void 0 : _a.stdin)) {
                throw new Error("Not connected");
            }
            const json = (0, stdio_js_1.serializeMessage)(message);
            if (this._process.stdin.write(json)) {
                resolve();
            }
            else {
                this._process.stdin.once("drain", resolve);
            }
        });
    }
}
exports.StdioClientTransport = StdioClientTransport;
function isElectron() {
    return "type" in node_process_1.default;
}
//# sourceMappingURL=stdio.js.map