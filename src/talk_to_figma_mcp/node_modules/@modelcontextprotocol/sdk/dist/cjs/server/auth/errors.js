"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsufficientScopeError = exports.InvalidClientMetadataError = exports.TooManyRequestsError = exports.MethodNotAllowedError = exports.InvalidTokenError = exports.UnsupportedTokenTypeError = exports.UnsupportedResponseTypeError = exports.TemporarilyUnavailableError = exports.ServerError = exports.AccessDeniedError = exports.InvalidScopeError = exports.UnsupportedGrantTypeError = exports.UnauthorizedClientError = exports.InvalidGrantError = exports.InvalidClientError = exports.InvalidRequestError = exports.OAuthError = void 0;
/**
 * Base class for all OAuth errors
 */
class OAuthError extends Error {
    constructor(errorCode, message, errorUri) {
        super(message);
        this.errorCode = errorCode;
        this.errorUri = errorUri;
        this.name = this.constructor.name;
    }
    /**
     * Converts the error to a standard OAuth error response object
     */
    toResponseObject() {
        const response = {
            error: this.errorCode,
            error_description: this.message
        };
        if (this.errorUri) {
            response.error_uri = this.errorUri;
        }
        return response;
    }
}
exports.OAuthError = OAuthError;
/**
 * Invalid request error - The request is missing a required parameter,
 * includes an invalid parameter value, includes a parameter more than once,
 * or is otherwise malformed.
 */
class InvalidRequestError extends OAuthError {
    constructor(message, errorUri) {
        super("invalid_request", message, errorUri);
    }
}
exports.InvalidRequestError = InvalidRequestError;
/**
 * Invalid client error - Client authentication failed (e.g., unknown client, no client
 * authentication included, or unsupported authentication method).
 */
class InvalidClientError extends OAuthError {
    constructor(message, errorUri) {
        super("invalid_client", message, errorUri);
    }
}
exports.InvalidClientError = InvalidClientError;
/**
 * Invalid grant error - The provided authorization grant or refresh token is
 * invalid, expired, revoked, does not match the redirection URI used in the
 * authorization request, or was issued to another client.
 */
class InvalidGrantError extends OAuthError {
    constructor(message, errorUri) {
        super("invalid_grant", message, errorUri);
    }
}
exports.InvalidGrantError = InvalidGrantError;
/**
 * Unauthorized client error - The authenticated client is not authorized to use
 * this authorization grant type.
 */
class UnauthorizedClientError extends OAuthError {
    constructor(message, errorUri) {
        super("unauthorized_client", message, errorUri);
    }
}
exports.UnauthorizedClientError = UnauthorizedClientError;
/**
 * Unsupported grant type error - The authorization grant type is not supported
 * by the authorization server.
 */
class UnsupportedGrantTypeError extends OAuthError {
    constructor(message, errorUri) {
        super("unsupported_grant_type", message, errorUri);
    }
}
exports.UnsupportedGrantTypeError = UnsupportedGrantTypeError;
/**
 * Invalid scope error - The requested scope is invalid, unknown, malformed, or
 * exceeds the scope granted by the resource owner.
 */
class InvalidScopeError extends OAuthError {
    constructor(message, errorUri) {
        super("invalid_scope", message, errorUri);
    }
}
exports.InvalidScopeError = InvalidScopeError;
/**
 * Access denied error - The resource owner or authorization server denied the request.
 */
class AccessDeniedError extends OAuthError {
    constructor(message, errorUri) {
        super("access_denied", message, errorUri);
    }
}
exports.AccessDeniedError = AccessDeniedError;
/**
 * Server error - The authorization server encountered an unexpected condition
 * that prevented it from fulfilling the request.
 */
class ServerError extends OAuthError {
    constructor(message, errorUri) {
        super("server_error", message, errorUri);
    }
}
exports.ServerError = ServerError;
/**
 * Temporarily unavailable error - The authorization server is currently unable to
 * handle the request due to a temporary overloading or maintenance of the server.
 */
class TemporarilyUnavailableError extends OAuthError {
    constructor(message, errorUri) {
        super("temporarily_unavailable", message, errorUri);
    }
}
exports.TemporarilyUnavailableError = TemporarilyUnavailableError;
/**
 * Unsupported response type error - The authorization server does not support
 * obtaining an authorization code using this method.
 */
class UnsupportedResponseTypeError extends OAuthError {
    constructor(message, errorUri) {
        super("unsupported_response_type", message, errorUri);
    }
}
exports.UnsupportedResponseTypeError = UnsupportedResponseTypeError;
/**
 * Unsupported token type error - The authorization server does not support
 * the requested token type.
 */
class UnsupportedTokenTypeError extends OAuthError {
    constructor(message, errorUri) {
        super("unsupported_token_type", message, errorUri);
    }
}
exports.UnsupportedTokenTypeError = UnsupportedTokenTypeError;
/**
 * Invalid token error - The access token provided is expired, revoked, malformed,
 * or invalid for other reasons.
 */
class InvalidTokenError extends OAuthError {
    constructor(message, errorUri) {
        super("invalid_token", message, errorUri);
    }
}
exports.InvalidTokenError = InvalidTokenError;
/**
 * Method not allowed error - The HTTP method used is not allowed for this endpoint.
 * (Custom, non-standard error)
 */
class MethodNotAllowedError extends OAuthError {
    constructor(message, errorUri) {
        super("method_not_allowed", message, errorUri);
    }
}
exports.MethodNotAllowedError = MethodNotAllowedError;
/**
 * Too many requests error - Rate limit exceeded.
 * (Custom, non-standard error based on RFC 6585)
 */
class TooManyRequestsError extends OAuthError {
    constructor(message, errorUri) {
        super("too_many_requests", message, errorUri);
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
/**
 * Invalid client metadata error - The client metadata is invalid.
 * (Custom error for dynamic client registration - RFC 7591)
 */
class InvalidClientMetadataError extends OAuthError {
    constructor(message, errorUri) {
        super("invalid_client_metadata", message, errorUri);
    }
}
exports.InvalidClientMetadataError = InvalidClientMetadataError;
/**
 * Insufficient scope error - The request requires higher privileges than provided by the access token.
 */
class InsufficientScopeError extends OAuthError {
    constructor(message, errorUri) {
        super("insufficient_scope", message, errorUri);
    }
}
exports.InsufficientScopeError = InsufficientScopeError;
//# sourceMappingURL=errors.js.map