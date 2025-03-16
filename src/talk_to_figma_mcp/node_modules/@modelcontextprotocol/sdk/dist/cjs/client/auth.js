"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnauthorizedError = void 0;
exports.auth = auth;
exports.discoverOAuthMetadata = discoverOAuthMetadata;
exports.startAuthorization = startAuthorization;
exports.exchangeAuthorization = exchangeAuthorization;
exports.refreshAuthorization = refreshAuthorization;
exports.registerClient = registerClient;
const pkce_challenge_1 = __importDefault(require("pkce-challenge"));
const types_js_1 = require("../types.js");
const auth_js_1 = require("../shared/auth.js");
class UnauthorizedError extends Error {
    constructor(message) {
        super(message !== null && message !== void 0 ? message : "Unauthorized");
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * Orchestrates the full auth flow with a server.
 *
 * This can be used as a single entry point for all authorization functionality,
 * instead of linking together the other lower-level functions in this module.
 */
async function auth(provider, { serverUrl, authorizationCode }) {
    const metadata = await discoverOAuthMetadata(serverUrl);
    // Handle client registration if needed
    let clientInformation = await Promise.resolve(provider.clientInformation());
    if (!clientInformation) {
        if (authorizationCode !== undefined) {
            throw new Error("Existing OAuth client information is required when exchanging an authorization code");
        }
        if (!provider.saveClientInformation) {
            throw new Error("OAuth client information must be saveable for dynamic registration");
        }
        const fullInformation = await registerClient(serverUrl, {
            metadata,
            clientMetadata: provider.clientMetadata,
        });
        await provider.saveClientInformation(fullInformation);
        clientInformation = fullInformation;
    }
    // Exchange authorization code for tokens
    if (authorizationCode !== undefined) {
        const codeVerifier = await provider.codeVerifier();
        const tokens = await exchangeAuthorization(serverUrl, {
            metadata,
            clientInformation,
            authorizationCode,
            codeVerifier,
        });
        await provider.saveTokens(tokens);
        return "AUTHORIZED";
    }
    const tokens = await provider.tokens();
    // Handle token refresh or new authorization
    if (tokens === null || tokens === void 0 ? void 0 : tokens.refresh_token) {
        try {
            // Attempt to refresh the token
            const newTokens = await refreshAuthorization(serverUrl, {
                metadata,
                clientInformation,
                refreshToken: tokens.refresh_token,
            });
            await provider.saveTokens(newTokens);
            return "AUTHORIZED";
        }
        catch (error) {
            console.error("Could not refresh OAuth tokens:", error);
        }
    }
    // Start new authorization flow
    const { authorizationUrl, codeVerifier } = await startAuthorization(serverUrl, {
        metadata,
        clientInformation,
        redirectUrl: provider.redirectUrl
    });
    await provider.saveCodeVerifier(codeVerifier);
    await provider.redirectToAuthorization(authorizationUrl);
    return "REDIRECT";
}
/**
 * Looks up RFC 8414 OAuth 2.0 Authorization Server Metadata.
 *
 * If the server returns a 404 for the well-known endpoint, this function will
 * return `undefined`. Any other errors will be thrown as exceptions.
 */
async function discoverOAuthMetadata(serverUrl, opts) {
    var _a;
    const url = new URL("/.well-known/oauth-authorization-server", serverUrl);
    let response;
    try {
        response = await fetch(url, {
            headers: {
                "MCP-Protocol-Version": (_a = opts === null || opts === void 0 ? void 0 : opts.protocolVersion) !== null && _a !== void 0 ? _a : types_js_1.LATEST_PROTOCOL_VERSION
            }
        });
    }
    catch (error) {
        // CORS errors come back as TypeError
        if (error instanceof TypeError) {
            response = await fetch(url);
        }
        else {
            throw error;
        }
    }
    if (response.status === 404) {
        return undefined;
    }
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} trying to load well-known OAuth metadata`);
    }
    return auth_js_1.OAuthMetadataSchema.parse(await response.json());
}
/**
 * Begins the authorization flow with the given server, by generating a PKCE challenge and constructing the authorization URL.
 */
async function startAuthorization(serverUrl, { metadata, clientInformation, redirectUrl, }) {
    const responseType = "code";
    const codeChallengeMethod = "S256";
    let authorizationUrl;
    if (metadata) {
        authorizationUrl = new URL(metadata.authorization_endpoint);
        if (!metadata.response_types_supported.includes(responseType)) {
            throw new Error(`Incompatible auth server: does not support response type ${responseType}`);
        }
        if (!metadata.code_challenge_methods_supported ||
            !metadata.code_challenge_methods_supported.includes(codeChallengeMethod)) {
            throw new Error(`Incompatible auth server: does not support code challenge method ${codeChallengeMethod}`);
        }
    }
    else {
        authorizationUrl = new URL("/authorize", serverUrl);
    }
    // Generate PKCE challenge
    const challenge = await (0, pkce_challenge_1.default)();
    const codeVerifier = challenge.code_verifier;
    const codeChallenge = challenge.code_challenge;
    authorizationUrl.searchParams.set("response_type", responseType);
    authorizationUrl.searchParams.set("client_id", clientInformation.client_id);
    authorizationUrl.searchParams.set("code_challenge", codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
    authorizationUrl.searchParams.set("redirect_uri", String(redirectUrl));
    return { authorizationUrl, codeVerifier };
}
/**
 * Exchanges an authorization code for an access token with the given server.
 */
async function exchangeAuthorization(serverUrl, { metadata, clientInformation, authorizationCode, codeVerifier, }) {
    const grantType = "authorization_code";
    let tokenUrl;
    if (metadata) {
        tokenUrl = new URL(metadata.token_endpoint);
        if (metadata.grant_types_supported &&
            !metadata.grant_types_supported.includes(grantType)) {
            throw new Error(`Incompatible auth server: does not support grant type ${grantType}`);
        }
    }
    else {
        tokenUrl = new URL("/token", serverUrl);
    }
    // Exchange code for tokens
    const params = new URLSearchParams({
        grant_type: grantType,
        client_id: clientInformation.client_id,
        code: authorizationCode,
        code_verifier: codeVerifier,
    });
    if (clientInformation.client_secret) {
        params.set("client_secret", clientInformation.client_secret);
    }
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
    });
    if (!response.ok) {
        throw new Error(`Token exchange failed: HTTP ${response.status}`);
    }
    return auth_js_1.OAuthTokensSchema.parse(await response.json());
}
/**
 * Exchange a refresh token for an updated access token.
 */
async function refreshAuthorization(serverUrl, { metadata, clientInformation, refreshToken, }) {
    const grantType = "refresh_token";
    let tokenUrl;
    if (metadata) {
        tokenUrl = new URL(metadata.token_endpoint);
        if (metadata.grant_types_supported &&
            !metadata.grant_types_supported.includes(grantType)) {
            throw new Error(`Incompatible auth server: does not support grant type ${grantType}`);
        }
    }
    else {
        tokenUrl = new URL("/token", serverUrl);
    }
    // Exchange refresh token
    const params = new URLSearchParams({
        grant_type: grantType,
        client_id: clientInformation.client_id,
        refresh_token: refreshToken,
    });
    if (clientInformation.client_secret) {
        params.set("client_secret", clientInformation.client_secret);
    }
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
    });
    if (!response.ok) {
        throw new Error(`Token refresh failed: HTTP ${response.status}`);
    }
    return auth_js_1.OAuthTokensSchema.parse(await response.json());
}
/**
 * Performs OAuth 2.0 Dynamic Client Registration according to RFC 7591.
 */
async function registerClient(serverUrl, { metadata, clientMetadata, }) {
    let registrationUrl;
    if (metadata) {
        if (!metadata.registration_endpoint) {
            throw new Error("Incompatible auth server: does not support dynamic client registration");
        }
        registrationUrl = new URL(metadata.registration_endpoint);
    }
    else {
        registrationUrl = new URL("/register", serverUrl);
    }
    const response = await fetch(registrationUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(clientMetadata),
    });
    if (!response.ok) {
        throw new Error(`Dynamic client registration failed: HTTP ${response.status}`);
    }
    return auth_js_1.OAuthClientInformationFullSchema.parse(await response.json());
}
//# sourceMappingURL=auth.js.map