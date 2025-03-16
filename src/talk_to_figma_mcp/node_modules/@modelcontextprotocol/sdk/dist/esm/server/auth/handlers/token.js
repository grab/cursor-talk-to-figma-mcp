import { z } from "zod";
import express from "express";
import cors from "cors";
import { verifyChallenge } from "pkce-challenge";
import { authenticateClient } from "../middleware/clientAuth.js";
import { rateLimit } from "express-rate-limit";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { InvalidRequestError, InvalidGrantError, UnsupportedGrantTypeError, ServerError, TooManyRequestsError, OAuthError } from "../errors.js";
const TokenRequestSchema = z.object({
    grant_type: z.string(),
});
const AuthorizationCodeGrantSchema = z.object({
    code: z.string(),
    code_verifier: z.string(),
});
const RefreshTokenGrantSchema = z.object({
    refresh_token: z.string(),
    scope: z.string().optional(),
});
export function tokenHandler({ provider, rateLimit: rateLimitConfig }) {
    // Nested router so we can configure middleware and restrict HTTP method
    const router = express.Router();
    // Configure CORS to allow any origin, to make accessible to web-based MCP clients
    router.use(cors());
    router.use(allowedMethods(["POST"]));
    router.use(express.urlencoded({ extended: false }));
    // Apply rate limiting unless explicitly disabled
    if (rateLimitConfig !== false) {
        router.use(rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 50, // 50 requests per windowMs 
            standardHeaders: true,
            legacyHeaders: false,
            message: new TooManyRequestsError('You have exceeded the rate limit for token requests').toResponseObject(),
            ...rateLimitConfig
        }));
    }
    // Authenticate and extract client details
    router.use(authenticateClient({ clientsStore: provider.clientsStore }));
    router.post("/", async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        try {
            const parseResult = TokenRequestSchema.safeParse(req.body);
            if (!parseResult.success) {
                throw new InvalidRequestError(parseResult.error.message);
            }
            const { grant_type } = parseResult.data;
            const client = req.client;
            if (!client) {
                // This should never happen
                console.error("Missing client information after authentication");
                throw new ServerError("Internal Server Error");
            }
            switch (grant_type) {
                case "authorization_code": {
                    const parseResult = AuthorizationCodeGrantSchema.safeParse(req.body);
                    if (!parseResult.success) {
                        throw new InvalidRequestError(parseResult.error.message);
                    }
                    const { code, code_verifier } = parseResult.data;
                    // Verify PKCE challenge
                    const codeChallenge = await provider.challengeForAuthorizationCode(client, code);
                    if (!(await verifyChallenge(code_verifier, codeChallenge))) {
                        throw new InvalidGrantError("code_verifier does not match the challenge");
                    }
                    const tokens = await provider.exchangeAuthorizationCode(client, code);
                    res.status(200).json(tokens);
                    break;
                }
                case "refresh_token": {
                    const parseResult = RefreshTokenGrantSchema.safeParse(req.body);
                    if (!parseResult.success) {
                        throw new InvalidRequestError(parseResult.error.message);
                    }
                    const { refresh_token, scope } = parseResult.data;
                    const scopes = scope === null || scope === void 0 ? void 0 : scope.split(" ");
                    const tokens = await provider.exchangeRefreshToken(client, refresh_token, scopes);
                    res.status(200).json(tokens);
                    break;
                }
                // Not supported right now
                //case "client_credentials":
                default:
                    throw new UnsupportedGrantTypeError("The grant type is not supported by this authorization server.");
            }
        }
        catch (error) {
            if (error instanceof OAuthError) {
                const status = error instanceof ServerError ? 500 : 400;
                res.status(status).json(error.toResponseObject());
            }
            else {
                console.error("Unexpected error exchanging token:", error);
                const serverError = new ServerError("Internal Server Error");
                res.status(500).json(serverError.toResponseObject());
            }
        }
    });
    return router;
}
//# sourceMappingURL=token.js.map