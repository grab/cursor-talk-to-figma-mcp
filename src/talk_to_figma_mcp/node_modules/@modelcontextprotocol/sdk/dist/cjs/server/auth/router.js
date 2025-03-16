"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpAuthRouter = mcpAuthRouter;
const express_1 = __importDefault(require("express"));
const register_js_1 = require("./handlers/register.js");
const token_js_1 = require("./handlers/token.js");
const authorize_js_1 = require("./handlers/authorize.js");
const revoke_js_1 = require("./handlers/revoke.js");
const metadata_js_1 = require("./handlers/metadata.js");
/**
 * Installs standard MCP authorization endpoints, including dynamic client registration and token revocation (if supported). Also advertises standard authorization server metadata, for easier discovery of supported configurations by clients.
 *
 * By default, rate limiting is applied to all endpoints to prevent abuse.
 *
 * This router MUST be installed at the application root, like so:
 *
 *  const app = express();
 *  app.use(mcpAuthRouter(...));
 */
function mcpAuthRouter(options) {
    var _a;
    const issuer = options.issuerUrl;
    // Technically RFC 8414 does not permit a localhost HTTPS exemption, but this will be necessary for ease of testing
    if (issuer.protocol !== "https:" && issuer.hostname !== "localhost" && issuer.hostname !== "127.0.0.1") {
        throw new Error("Issuer URL must be HTTPS");
    }
    if (issuer.hash) {
        throw new Error("Issuer URL must not have a fragment");
    }
    if (issuer.search) {
        throw new Error("Issuer URL must not have a query string");
    }
    const authorization_endpoint = "/authorize";
    const token_endpoint = "/token";
    const registration_endpoint = options.provider.clientsStore.registerClient ? "/register" : undefined;
    const revocation_endpoint = options.provider.revokeToken ? "/revoke" : undefined;
    const metadata = {
        issuer: issuer.href,
        service_documentation: (_a = options.serviceDocumentationUrl) === null || _a === void 0 ? void 0 : _a.href,
        authorization_endpoint: new URL(authorization_endpoint, issuer).href,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint: new URL(token_endpoint, issuer).href,
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        revocation_endpoint: revocation_endpoint ? new URL(revocation_endpoint, issuer).href : undefined,
        revocation_endpoint_auth_methods_supported: revocation_endpoint ? ["client_secret_post"] : undefined,
        registration_endpoint: registration_endpoint ? new URL(registration_endpoint, issuer).href : undefined,
    };
    const router = express_1.default.Router();
    router.use(authorization_endpoint, (0, authorize_js_1.authorizationHandler)({ provider: options.provider, ...options.authorizationOptions }));
    router.use(token_endpoint, (0, token_js_1.tokenHandler)({ provider: options.provider, ...options.tokenOptions }));
    router.use("/.well-known/oauth-authorization-server", (0, metadata_js_1.metadataHandler)(metadata));
    if (registration_endpoint) {
        router.use(registration_endpoint, (0, register_js_1.clientRegistrationHandler)({
            clientsStore: options.provider.clientsStore,
            ...options,
        }));
    }
    if (revocation_endpoint) {
        router.use(revocation_endpoint, (0, revoke_js_1.revocationHandler)({ provider: options.provider, ...options.revocationOptions }));
    }
    return router;
}
//# sourceMappingURL=router.js.map