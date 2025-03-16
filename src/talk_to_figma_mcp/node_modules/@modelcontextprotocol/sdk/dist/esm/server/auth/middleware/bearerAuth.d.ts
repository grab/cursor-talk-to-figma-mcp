import { RequestHandler } from "express";
import { OAuthServerProvider } from "../provider.js";
import { AuthInfo } from "../types.js";
export type BearerAuthMiddlewareOptions = {
    /**
     * A provider used to verify tokens.
     */
    provider: OAuthServerProvider;
    /**
     * Optional scopes that the token must have.
     */
    requiredScopes?: string[];
};
declare module "express-serve-static-core" {
    interface Request {
        /**
         * Information about the validated access token, if the `requireBearerAuth` middleware was used.
         */
        auth?: AuthInfo;
    }
}
/**
 * Middleware that requires a valid Bearer token in the Authorization header.
 *
 * This will validate the token with the auth provider and add the resulting auth info to the request object.
 */
export declare function requireBearerAuth({ provider, requiredScopes }: BearerAuthMiddlewareOptions): RequestHandler;
//# sourceMappingURL=bearerAuth.d.ts.map