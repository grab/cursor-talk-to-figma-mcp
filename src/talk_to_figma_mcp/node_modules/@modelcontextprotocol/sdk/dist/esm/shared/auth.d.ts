import { z } from "zod";
/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata
 */
export declare const OAuthMetadataSchema: z.ZodObject<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodString;
    token_endpoint: z.ZodString;
    registration_endpoint: z.ZodOptional<z.ZodString>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    revocation_endpoint: z.ZodOptional<z.ZodString>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodString;
    token_endpoint: z.ZodString;
    registration_endpoint: z.ZodOptional<z.ZodString>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    revocation_endpoint: z.ZodOptional<z.ZodString>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodString;
    token_endpoint: z.ZodString;
    registration_endpoint: z.ZodOptional<z.ZodString>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    revocation_endpoint: z.ZodOptional<z.ZodString>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * OAuth 2.1 token response
 */
export declare const OAuthTokensSchema: z.ZodObject<{
    access_token: z.ZodString;
    token_type: z.ZodString;
    expires_in: z.ZodOptional<z.ZodNumber>;
    scope: z.ZodOptional<z.ZodString>;
    refresh_token: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    access_token: string;
    token_type: string;
    expires_in?: number | undefined;
    scope?: string | undefined;
    refresh_token?: string | undefined;
}, {
    access_token: string;
    token_type: string;
    expires_in?: number | undefined;
    scope?: string | undefined;
    refresh_token?: string | undefined;
}>;
/**
 * OAuth 2.1 error response
 */
export declare const OAuthErrorResponseSchema: z.ZodObject<{
    error: z.ZodString;
    error_description: z.ZodOptional<z.ZodString>;
    error_uri: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    error: string;
    error_description?: string | undefined;
    error_uri?: string | undefined;
}, {
    error: string;
    error_description?: string | undefined;
    error_uri?: string | undefined;
}>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration metadata
 */
export declare const OAuthClientMetadataSchema: z.ZodObject<{
    redirect_uris: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
    token_endpoint_auth_method: z.ZodOptional<z.ZodString>;
    grant_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    client_name: z.ZodOptional<z.ZodString>;
    client_uri: z.ZodOptional<z.ZodString>;
    logo_uri: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    contacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tos_uri: z.ZodOptional<z.ZodString>;
    policy_uri: z.ZodOptional<z.ZodString>;
    jwks_uri: z.ZodOptional<z.ZodString>;
    jwks: z.ZodOptional<z.ZodAny>;
    software_id: z.ZodOptional<z.ZodString>;
    software_version: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    redirect_uris: string[];
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
}, {
    redirect_uris: string[];
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
}>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration client information
 */
export declare const OAuthClientInformationSchema: z.ZodObject<{
    client_id: z.ZodString;
    client_secret: z.ZodOptional<z.ZodString>;
    client_id_issued_at: z.ZodOptional<z.ZodNumber>;
    client_secret_expires_at: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    client_id: string;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}, {
    client_id: string;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration full response (client information plus metadata)
 */
export declare const OAuthClientInformationFullSchema: z.ZodObject<z.objectUtil.extendShape<{
    redirect_uris: z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>;
    token_endpoint_auth_method: z.ZodOptional<z.ZodString>;
    grant_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    client_name: z.ZodOptional<z.ZodString>;
    client_uri: z.ZodOptional<z.ZodString>;
    logo_uri: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodString>;
    contacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tos_uri: z.ZodOptional<z.ZodString>;
    policy_uri: z.ZodOptional<z.ZodString>;
    jwks_uri: z.ZodOptional<z.ZodString>;
    jwks: z.ZodOptional<z.ZodAny>;
    software_id: z.ZodOptional<z.ZodString>;
    software_version: z.ZodOptional<z.ZodString>;
}, {
    client_id: z.ZodString;
    client_secret: z.ZodOptional<z.ZodString>;
    client_id_issued_at: z.ZodOptional<z.ZodNumber>;
    client_secret_expires_at: z.ZodOptional<z.ZodNumber>;
}>, "strip", z.ZodTypeAny, {
    redirect_uris: string[];
    client_id: string;
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}, {
    redirect_uris: string[];
    client_id: string;
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration error response
 */
export declare const OAuthClientRegistrationErrorSchema: z.ZodObject<{
    error: z.ZodString;
    error_description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    error: string;
    error_description?: string | undefined;
}, {
    error: string;
    error_description?: string | undefined;
}>;
/**
 * RFC 7009 OAuth 2.0 Token Revocation request
 */
export declare const OAuthTokenRevocationRequestSchema: z.ZodObject<{
    token: z.ZodString;
    token_type_hint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    token: string;
    token_type_hint?: string | undefined;
}, {
    token: string;
    token_type_hint?: string | undefined;
}>;
export type OAuthMetadata = z.infer<typeof OAuthMetadataSchema>;
export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;
export type OAuthErrorResponse = z.infer<typeof OAuthErrorResponseSchema>;
export type OAuthClientMetadata = z.infer<typeof OAuthClientMetadataSchema>;
export type OAuthClientInformation = z.infer<typeof OAuthClientInformationSchema>;
export type OAuthClientInformationFull = z.infer<typeof OAuthClientInformationFullSchema>;
export type OAuthClientRegistrationError = z.infer<typeof OAuthClientRegistrationErrorSchema>;
export type OAuthTokenRevocationRequest = z.infer<typeof OAuthTokenRevocationRequestSchema>;
//# sourceMappingURL=auth.d.ts.map