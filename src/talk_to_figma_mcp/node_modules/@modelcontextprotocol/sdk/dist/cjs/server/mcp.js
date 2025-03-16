"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceTemplate = exports.McpServer = void 0;
const index_js_1 = require("./index.js");
const zod_to_json_schema_1 = require("zod-to-json-schema");
const zod_1 = require("zod");
const types_js_1 = require("../types.js");
const completable_js_1 = require("./completable.js");
const uriTemplate_js_1 = require("../shared/uriTemplate.js");
/**
 * High-level MCP server that provides a simpler API for working with resources, tools, and prompts.
 * For advanced usage (like sending notifications or setting custom request handlers), use the underlying
 * Server instance available via the `server` property.
 */
class McpServer {
    constructor(serverInfo, options) {
        this._registeredResources = {};
        this._registeredResourceTemplates = {};
        this._registeredTools = {};
        this._registeredPrompts = {};
        this._toolHandlersInitialized = false;
        this._completionHandlerInitialized = false;
        this._resourceHandlersInitialized = false;
        this._promptHandlersInitialized = false;
        this.server = new index_js_1.Server(serverInfo, options);
    }
    /**
     * Attaches to the given transport, starts it, and starts listening for messages.
     *
     * The `server` object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
     */
    async connect(transport) {
        return await this.server.connect(transport);
    }
    /**
     * Closes the connection.
     */
    async close() {
        await this.server.close();
    }
    setToolRequestHandlers() {
        if (this._toolHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(types_js_1.ListToolsRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(types_js_1.CallToolRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            tools: {},
        });
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, () => ({
            tools: Object.entries(this._registeredTools).map(([name, tool]) => {
                return {
                    name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                        ? (0, zod_to_json_schema_1.zodToJsonSchema)(tool.inputSchema, {
                            strictUnions: true,
                        })
                        : EMPTY_OBJECT_JSON_SCHEMA,
                };
            }),
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request, extra) => {
            const tool = this._registeredTools[request.params.name];
            if (!tool) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
            }
            if (tool.inputSchema) {
                const parseResult = await tool.inputSchema.safeParseAsync(request.params.arguments);
                if (!parseResult.success) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Invalid arguments for tool ${request.params.name}: ${parseResult.error.message}`);
                }
                const args = parseResult.data;
                const cb = tool.callback;
                try {
                    return await Promise.resolve(cb(args, extra));
                }
                catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: error instanceof Error ? error.message : String(error),
                            },
                        ],
                        isError: true,
                    };
                }
            }
            else {
                const cb = tool.callback;
                try {
                    return await Promise.resolve(cb(extra));
                }
                catch (error) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: error instanceof Error ? error.message : String(error),
                            },
                        ],
                        isError: true,
                    };
                }
            }
        });
        this._toolHandlersInitialized = true;
    }
    setCompletionRequestHandler() {
        if (this._completionHandlerInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(types_js_1.CompleteRequestSchema.shape.method.value);
        this.server.setRequestHandler(types_js_1.CompleteRequestSchema, async (request) => {
            switch (request.params.ref.type) {
                case "ref/prompt":
                    return this.handlePromptCompletion(request, request.params.ref);
                case "ref/resource":
                    return this.handleResourceCompletion(request, request.params.ref);
                default:
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Invalid completion reference: ${request.params.ref}`);
            }
        });
        this._completionHandlerInitialized = true;
    }
    async handlePromptCompletion(request, ref) {
        const prompt = this._registeredPrompts[ref.name];
        if (!prompt) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Prompt ${request.params.ref.name} not found`);
        }
        if (!prompt.argsSchema) {
            return EMPTY_COMPLETION_RESULT;
        }
        const field = prompt.argsSchema.shape[request.params.argument.name];
        if (!(field instanceof completable_js_1.Completable)) {
            return EMPTY_COMPLETION_RESULT;
        }
        const def = field._def;
        const suggestions = await def.complete(request.params.argument.value);
        return createCompletionResult(suggestions);
    }
    async handleResourceCompletion(request, ref) {
        const template = Object.values(this._registeredResourceTemplates).find((t) => t.resourceTemplate.uriTemplate.toString() === ref.uri);
        if (!template) {
            if (this._registeredResources[ref.uri]) {
                // Attempting to autocomplete a fixed resource URI is not an error in the spec (but probably should be).
                return EMPTY_COMPLETION_RESULT;
            }
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Resource template ${request.params.ref.uri} not found`);
        }
        const completer = template.resourceTemplate.completeCallback(request.params.argument.name);
        if (!completer) {
            return EMPTY_COMPLETION_RESULT;
        }
        const suggestions = await completer(request.params.argument.value);
        return createCompletionResult(suggestions);
    }
    setResourceRequestHandlers() {
        if (this._resourceHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(types_js_1.ListResourcesRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(types_js_1.ListResourceTemplatesRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(types_js_1.ReadResourceRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            resources: {},
        });
        this.server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async (request, extra) => {
            const resources = Object.entries(this._registeredResources).map(([uri, resource]) => ({
                uri,
                name: resource.name,
                ...resource.metadata,
            }));
            const templateResources = [];
            for (const template of Object.values(this._registeredResourceTemplates)) {
                if (!template.resourceTemplate.listCallback) {
                    continue;
                }
                const result = await template.resourceTemplate.listCallback(extra);
                for (const resource of result.resources) {
                    templateResources.push({
                        ...resource,
                        ...template.metadata,
                    });
                }
            }
            return { resources: [...resources, ...templateResources] };
        });
        this.server.setRequestHandler(types_js_1.ListResourceTemplatesRequestSchema, async () => {
            const resourceTemplates = Object.entries(this._registeredResourceTemplates).map(([name, template]) => ({
                name,
                uriTemplate: template.resourceTemplate.uriTemplate.toString(),
                ...template.metadata,
            }));
            return { resourceTemplates };
        });
        this.server.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (request, extra) => {
            const uri = new URL(request.params.uri);
            // First check for exact resource match
            const resource = this._registeredResources[uri.toString()];
            if (resource) {
                return resource.readCallback(uri, extra);
            }
            // Then check templates
            for (const template of Object.values(this._registeredResourceTemplates)) {
                const variables = template.resourceTemplate.uriTemplate.match(uri.toString());
                if (variables) {
                    return template.readCallback(uri, variables, extra);
                }
            }
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Resource ${uri} not found`);
        });
        this.setCompletionRequestHandler();
        this._resourceHandlersInitialized = true;
    }
    setPromptRequestHandlers() {
        if (this._promptHandlersInitialized) {
            return;
        }
        this.server.assertCanSetRequestHandler(types_js_1.ListPromptsRequestSchema.shape.method.value);
        this.server.assertCanSetRequestHandler(types_js_1.GetPromptRequestSchema.shape.method.value);
        this.server.registerCapabilities({
            prompts: {},
        });
        this.server.setRequestHandler(types_js_1.ListPromptsRequestSchema, () => ({
            prompts: Object.entries(this._registeredPrompts).map(([name, prompt]) => {
                return {
                    name,
                    description: prompt.description,
                    arguments: prompt.argsSchema
                        ? promptArgumentsFromSchema(prompt.argsSchema)
                        : undefined,
                };
            }),
        }));
        this.server.setRequestHandler(types_js_1.GetPromptRequestSchema, async (request, extra) => {
            const prompt = this._registeredPrompts[request.params.name];
            if (!prompt) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
            }
            if (prompt.argsSchema) {
                const parseResult = await prompt.argsSchema.safeParseAsync(request.params.arguments);
                if (!parseResult.success) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Invalid arguments for prompt ${request.params.name}: ${parseResult.error.message}`);
                }
                const args = parseResult.data;
                const cb = prompt.callback;
                return await Promise.resolve(cb(args, extra));
            }
            else {
                const cb = prompt.callback;
                return await Promise.resolve(cb(extra));
            }
        });
        this.setCompletionRequestHandler();
        this._promptHandlersInitialized = true;
    }
    resource(name, uriOrTemplate, ...rest) {
        let metadata;
        if (typeof rest[0] === "object") {
            metadata = rest.shift();
        }
        const readCallback = rest[0];
        if (typeof uriOrTemplate === "string") {
            if (this._registeredResources[uriOrTemplate]) {
                throw new Error(`Resource ${uriOrTemplate} is already registered`);
            }
            this._registeredResources[uriOrTemplate] = {
                name,
                metadata,
                readCallback: readCallback,
            };
        }
        else {
            if (this._registeredResourceTemplates[name]) {
                throw new Error(`Resource template ${name} is already registered`);
            }
            this._registeredResourceTemplates[name] = {
                resourceTemplate: uriOrTemplate,
                metadata,
                readCallback: readCallback,
            };
        }
        this.setResourceRequestHandlers();
    }
    tool(name, ...rest) {
        if (this._registeredTools[name]) {
            throw new Error(`Tool ${name} is already registered`);
        }
        let description;
        if (typeof rest[0] === "string") {
            description = rest.shift();
        }
        let paramsSchema;
        if (rest.length > 1) {
            paramsSchema = rest.shift();
        }
        const cb = rest[0];
        this._registeredTools[name] = {
            description,
            inputSchema: paramsSchema === undefined ? undefined : zod_1.z.object(paramsSchema),
            callback: cb,
        };
        this.setToolRequestHandlers();
    }
    prompt(name, ...rest) {
        if (this._registeredPrompts[name]) {
            throw new Error(`Prompt ${name} is already registered`);
        }
        let description;
        if (typeof rest[0] === "string") {
            description = rest.shift();
        }
        let argsSchema;
        if (rest.length > 1) {
            argsSchema = rest.shift();
        }
        const cb = rest[0];
        this._registeredPrompts[name] = {
            description,
            argsSchema: argsSchema === undefined ? undefined : zod_1.z.object(argsSchema),
            callback: cb,
        };
        this.setPromptRequestHandlers();
    }
}
exports.McpServer = McpServer;
/**
 * A resource template combines a URI pattern with optional functionality to enumerate
 * all resources matching that pattern.
 */
class ResourceTemplate {
    constructor(uriTemplate, _callbacks) {
        this._callbacks = _callbacks;
        this._uriTemplate =
            typeof uriTemplate === "string"
                ? new uriTemplate_js_1.UriTemplate(uriTemplate)
                : uriTemplate;
    }
    /**
     * Gets the URI template pattern.
     */
    get uriTemplate() {
        return this._uriTemplate;
    }
    /**
     * Gets the list callback, if one was provided.
     */
    get listCallback() {
        return this._callbacks.list;
    }
    /**
     * Gets the callback for completing a specific URI template variable, if one was provided.
     */
    completeCallback(variable) {
        var _a;
        return (_a = this._callbacks.complete) === null || _a === void 0 ? void 0 : _a[variable];
    }
}
exports.ResourceTemplate = ResourceTemplate;
const EMPTY_OBJECT_JSON_SCHEMA = {
    type: "object",
};
function promptArgumentsFromSchema(schema) {
    return Object.entries(schema.shape).map(([name, field]) => ({
        name,
        description: field.description,
        required: !field.isOptional(),
    }));
}
function createCompletionResult(suggestions) {
    return {
        completion: {
            values: suggestions.slice(0, 100),
            total: suggestions.length,
            hasMore: suggestions.length > 100,
        },
    };
}
const EMPTY_COMPLETION_RESULT = {
    completion: {
        values: [],
        hasMore: false,
    },
};
//# sourceMappingURL=mcp.js.map