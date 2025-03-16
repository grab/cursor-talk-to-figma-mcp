import { OAuthErrorResponse } from "../../shared/auth.js";
/**
 * Base class for all OAuth errors
 */
export declare class OAuthError extends Error {
    readonly errorCode: string;
    readonly errorUri?: string | undefined;
    constructor(errorCode: string, message: string, errorUri?: string | undefined);
    /**
     * Converts the error to a standard OAuth error response object
     */
    toResponseObject(): OAuthErrorResponse;
}
/**
 * Invalid request error - The request is missing a required parameter,
 * includes an invalid parameter value, includes a parameter more than once,
 * or is otherwise malformed.
 */
export declare class InvalidRequestError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Invalid client error - Client authentication failed (e.g., unknown client, no client
 * authentication included, or unsupported authentication method).
 */
export declare class InvalidClientError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Invalid grant error - The provided authorization grant or refresh token is
 * invalid, expired, revoked, does not match the redirection URI used in the
 * authorization request, or was issued to another client.
 */
export declare class InvalidGrantError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Unauthorized client error - The authenticated client is not authorized to use
 * this authorization grant type.
 */
export declare class UnauthorizedClientError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Unsupported grant type error - The authorization grant type is not supported
 * by the authorization server.
 */
export declare class UnsupportedGrantTypeError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Invalid scope error - The requested scope is invalid, unknown, malformed, or
 * exceeds the scope granted by the resource owner.
 */
export declare class InvalidScopeError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Access denied error - The resource owner or authorization server denied the request.
 */
export declare class AccessDeniedError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Server error - The authorization server encountered an unexpected condition
 * that prevented it from fulfilling the request.
 */
export declare class ServerError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Temporarily unavailable error - The authorization server is currently unable to
 * handle the request due to a temporary overloading or maintenance of the server.
 */
export declare class TemporarilyUnavailableError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Unsupported response type error - The authorization server does not support
 * obtaining an authorization code using this method.
 */
export declare class UnsupportedResponseTypeError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Unsupported token type error - The authorization server does not support
 * the requested token type.
 */
export declare class UnsupportedTokenTypeError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Invalid token error - The access token provided is expired, revoked, malformed,
 * or invalid for other reasons.
 */
export declare class InvalidTokenError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Method not allowed error - The HTTP method used is not allowed for this endpoint.
 * (Custom, non-standard error)
 */
export declare class MethodNotAllowedError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Too many requests error - Rate limit exceeded.
 * (Custom, non-standard error based on RFC 6585)
 */
export declare class TooManyRequestsError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Invalid client metadata error - The client metadata is invalid.
 * (Custom error for dynamic client registration - RFC 7591)
 */
export declare class InvalidClientMetadataError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
/**
 * Insufficient scope error - The request requires higher privileges than provided by the access token.
 */
export declare class InsufficientScopeError extends OAuthError {
    constructor(message: string, errorUri?: string);
}
//# sourceMappingURL=errors.d.ts.map