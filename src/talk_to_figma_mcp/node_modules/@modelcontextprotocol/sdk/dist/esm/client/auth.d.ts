import type { OAuthClientMetadata, OAuthClientInformation, OAuthTokens, OAuthMetadata, OAuthClientInformationFull } from "../shared/auth.js";
/**
 * Implements an end-to-end OAuth client to be used with one MCP server.
 *
 * This client relies upon a concept of an authorized "session," the exact
 * meaning of which is application-defined. Tokens, authorization codes, and
 * code verifiers should not cross different sessions.
 */
export interface OAuthClientProvider {
    /**
     * The URL to redirect the user agent to after authorization.
     */
    get redirectUrl(): string | URL;
    /**
     * Metadata about this OAuth client.
     */
    get clientMetadata(): OAuthClientMetadata;
    /**
     * Loads information about this OAuth client, as registered already with the
     * server, or returns `undefined` if the client is not registered with the
     * server.
     */
    clientInformation(): OAuthClientInformation | undefined | Promise<OAuthClientInformation | undefined>;
    /**
     * If implemented, this permits the OAuth client to dynamically register with
     * the server. Client information saved this way should later be read via
     * `clientInformation()`.
     *
     * This method is not required to be implemented if client information is
     * statically known (e.g., pre-registered).
     */
    saveClientInformation?(clientInformation: OAuthClientInformationFull): void | Promise<void>;
    /**
     * Loads any existing OAuth tokens for the current session, or returns
     * `undefined` if there are no saved tokens.
     */
    tokens(): OAuthTokens | undefined | Promise<OAuthTokens | undefined>;
    /**
     * Stores new OAuth tokens for the current session, after a successful
     * authorization.
     */
    saveTokens(tokens: OAuthTokens): void | Promise<void>;
    /**
     * Invoked to redirect the user agent to the given URL to begin the authorization flow.
     */
    redirectToAuthorization(authorizationUrl: URL): void | Promise<void>;
    /**
     * Saves a PKCE code verifier for the current session, before redirecting to
     * the authorization flow.
     */
    saveCodeVerifier(codeVerifier: string): void | Promise<void>;
    /**
     * Loads the PKCE code verifier for the current session, necessary to validate
     * the authorization result.
     */
    codeVerifier(): string | Promise<string>;
}
export type AuthResult = "AUTHORIZED" | "REDIRECT";
export declare class UnauthorizedError extends Error {
    constructor(message?: string);
}
/**
 * Orchestrates the full auth flow with a server.
 *
 * This can be used as a single entry point for all authorization functionality,
 * instead of linking together the other lower-level functions in this module.
 */
export declare function auth(provider: OAuthClientProvider, { serverUrl, authorizationCode }: {
    serverUrl: string | URL;
    authorizationCode?: string;
}): Promise<AuthResult>;
/**
 * Looks up RFC 8414 OAuth 2.0 Authorization Server Metadata.
 *
 * If the server returns a 404 for the well-known endpoint, this function will
 * return `undefined`. Any other errors will be thrown as exceptions.
 */
export declare function discoverOAuthMetadata(serverUrl: string | URL, opts?: {
    protocolVersion?: string;
}): Promise<OAuthMetadata | undefined>;
/**
 * Begins the authorization flow with the given server, by generating a PKCE challenge and constructing the authorization URL.
 */
export declare function startAuthorization(serverUrl: string | URL, { metadata, clientInformation, redirectUrl, }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    redirectUrl: string | URL;
}): Promise<{
    authorizationUrl: URL;
    codeVerifier: string;
}>;
/**
 * Exchanges an authorization code for an access token with the given server.
 */
export declare function exchangeAuthorization(serverUrl: string | URL, { metadata, clientInformation, authorizationCode, codeVerifier, }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    authorizationCode: string;
    codeVerifier: string;
}): Promise<OAuthTokens>;
/**
 * Exchange a refresh token for an updated access token.
 */
export declare function refreshAuthorization(serverUrl: string | URL, { metadata, clientInformation, refreshToken, }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    refreshToken: string;
}): Promise<OAuthTokens>;
/**
 * Performs OAuth 2.0 Dynamic Client Registration according to RFC 7591.
 */
export declare function registerClient(serverUrl: string | URL, { metadata, clientMetadata, }: {
    metadata?: OAuthMetadata;
    clientMetadata: OAuthClientMetadata;
}): Promise<OAuthClientInformationFull>;
//# sourceMappingURL=auth.d.ts.map