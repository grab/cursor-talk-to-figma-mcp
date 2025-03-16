"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthTokenRevocationRequestSchema = exports.OAuthClientRegistrationErrorSchema = exports.OAuthClientInformationFullSchema = exports.OAuthClientInformationSchema = exports.OAuthClientMetadataSchema = exports.OAuthErrorResponseSchema = exports.OAuthTokensSchema = exports.OAuthMetadataSchema = void 0;
const zod_1 = require("zod");
/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata
 */
exports.OAuthMetadataSchema = zod_1.z
    .object({
    issuer: zod_1.z.string(),
    authorization_endpoint: zod_1.z.string(),
    token_endpoint: zod_1.z.string(),
    registration_endpoint: zod_1.z.string().optional(),
    scopes_supported: zod_1.z.array(zod_1.z.string()).optional(),
    response_types_supported: zod_1.z.array(zod_1.z.string()),
    response_modes_supported: zod_1.z.array(zod_1.z.string()).optional(),
    grant_types_supported: zod_1.z.array(zod_1.z.string()).optional(),
    token_endpoint_auth_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
    token_endpoint_auth_signing_alg_values_supported: zod_1.z
        .array(zod_1.z.string())
        .optional(),
    service_documentation: zod_1.z.string().optional(),
    revocation_endpoint: zod_1.z.string().optional(),
    revocation_endpoint_auth_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
    revocation_endpoint_auth_signing_alg_values_supported: zod_1.z
        .array(zod_1.z.string())
        .optional(),
    introspection_endpoint: zod_1.z.string().optional(),
    introspection_endpoint_auth_methods_supported: zod_1.z
        .array(zod_1.z.string())
        .optional(),
    introspection_endpoint_auth_signing_alg_values_supported: zod_1.z
        .array(zod_1.z.string())
        .optional(),
    code_challenge_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
})
    .passthrough();
/**
 * OAuth 2.1 token response
 */
exports.OAuthTokensSchema = zod_1.z
    .object({
    access_token: zod_1.z.string(),
    token_type: zod_1.z.string(),
    expires_in: zod_1.z.number().optional(),
    scope: zod_1.z.string().optional(),
    refresh_token: zod_1.z.string().optional(),
})
    .strip();
/**
 * OAuth 2.1 error response
 */
exports.OAuthErrorResponseSchema = zod_1.z
    .object({
    error: zod_1.z.string(),
    error_description: zod_1.z.string().optional(),
    error_uri: zod_1.z.string().optional(),
});
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration metadata
 */
exports.OAuthClientMetadataSchema = zod_1.z.object({
    redirect_uris: zod_1.z.array(zod_1.z.string()).refine((uris) => uris.every((uri) => URL.canParse(uri)), { message: "redirect_uris must contain valid URLs" }),
    token_endpoint_auth_method: zod_1.z.string().optional(),
    grant_types: zod_1.z.array(zod_1.z.string()).optional(),
    response_types: zod_1.z.array(zod_1.z.string()).optional(),
    client_name: zod_1.z.string().optional(),
    client_uri: zod_1.z.string().optional(),
    logo_uri: zod_1.z.string().optional(),
    scope: zod_1.z.string().optional(),
    contacts: zod_1.z.array(zod_1.z.string()).optional(),
    tos_uri: zod_1.z.string().optional(),
    policy_uri: zod_1.z.string().optional(),
    jwks_uri: zod_1.z.string().optional(),
    jwks: zod_1.z.any().optional(),
    software_id: zod_1.z.string().optional(),
    software_version: zod_1.z.string().optional(),
}).strip();
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration client information
 */
exports.OAuthClientInformationSchema = zod_1.z.object({
    client_id: zod_1.z.string(),
    client_secret: zod_1.z.string().optional(),
    client_id_issued_at: zod_1.z.number().optional(),
    client_secret_expires_at: zod_1.z.number().optional(),
}).strip();
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration full response (client information plus metadata)
 */
exports.OAuthClientInformationFullSchema = exports.OAuthClientMetadataSchema.merge(exports.OAuthClientInformationSchema);
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration error response
 */
exports.OAuthClientRegistrationErrorSchema = zod_1.z.object({
    error: zod_1.z.string(),
    error_description: zod_1.z.string().optional(),
}).strip();
/**
 * RFC 7009 OAuth 2.0 Token Revocation request
 */
exports.OAuthTokenRevocationRequestSchema = zod_1.z.object({
    token: zod_1.z.string(),
    token_type_hint: zod_1.z.string().optional(),
}).strip();
//# sourceMappingURL=auth.js.map