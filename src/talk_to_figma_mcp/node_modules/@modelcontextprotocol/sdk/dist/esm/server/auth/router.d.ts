import { RequestHandler } from "express";
import { ClientRegistrationHandlerOptions } from "./handlers/register.js";
import { TokenHandlerOptions } from "./handlers/token.js";
import { AuthorizationHandlerOptions } from "./handlers/authorize.js";
import { RevocationHandlerOptions } from "./handlers/revoke.js";
import { OAuthServerProvider } from "./provider.js";
export type AuthRouterOptions = {
    /**
     * A provider implementing the actual authorization logic for this router.
     */
    provider: OAuthServerProvider;
    /**
     * The authorization server's issuer identifier, which is a URL that uses the "https" scheme and has no query or fragment components.
     */
    issuerUrl: URL;
    /**
     * An optional URL of a page containing human-readable information that developers might want or need to know when using the authorization server.
     */
    serviceDocumentationUrl?: URL;
    authorizationOptions?: Omit<AuthorizationHandlerOptions, "provider">;
    clientRegistrationOptions?: Omit<ClientRegistrationHandlerOptions, "clientsStore">;
    revocationOptions?: Omit<RevocationHandlerOptions, "provider">;
    tokenOptions?: Omit<TokenHandlerOptions, "provider">;
};
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
export declare function mcpAuthRouter(options: AuthRouterOptions): RequestHandler;
//# sourceMappingURL=router.d.ts.map