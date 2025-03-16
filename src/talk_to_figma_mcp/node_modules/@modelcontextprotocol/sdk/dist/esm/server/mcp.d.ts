import { Server, ServerOptions } from "./index.js";
import { z, ZodRawShape, ZodTypeAny, ZodType, ZodTypeDef, ZodOptional } from "zod";
import { Implementation, CallToolResult, Resource, ListResourcesResult, GetPromptResult, ReadResourceResult } from "../types.js";
import { UriTemplate, Variables } from "../shared/uriTemplate.js";
import { RequestHandlerExtra } from "../shared/protocol.js";
import { Transport } from "../shared/transport.js";
/**
 * High-level MCP server that provides a simpler API for working with resources, tools, and prompts.
 * For advanced usage (like sending notifications or setting custom request handlers), use the underlying
 * Server instance available via the `server` property.
 */
export declare class McpServer {
    /**
     * The underlying Server instance, useful for advanced operations like sending notifications.
     */
    readonly server: Server;
    private _registeredResources;
    private _registeredResourceTemplates;
    private _registeredTools;
    private _registeredPrompts;
    constructor(serverInfo: Implementation, options?: ServerOptions);
    /**
     * Attaches to the given transport, starts it, and starts listening for messages.
     *
     * The `server` object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
     */
    connect(transport: Transport): Promise<void>;
    /**
     * Closes the connection.
     */
    close(): Promise<void>;
    private _toolHandlersInitialized;
    private setToolRequestHandlers;
    private _completionHandlerInitialized;
    private setCompletionRequestHandler;
    private handlePromptCompletion;
    private handleResourceCompletion;
    private _resourceHandlersInitialized;
    private setResourceRequestHandlers;
    private _promptHandlersInitialized;
    private setPromptRequestHandlers;
    /**
     * Registers a resource `name` at a fixed URI, which will use the given callback to respond to read requests.
     */
    resource(name: string, uri: string, readCallback: ReadResourceCallback): void;
    /**
     * Registers a resource `name` at a fixed URI with metadata, which will use the given callback to respond to read requests.
     */
    resource(name: string, uri: string, metadata: ResourceMetadata, readCallback: ReadResourceCallback): void;
    /**
     * Registers a resource `name` with a template pattern, which will use the given callback to respond to read requests.
     */
    resource(name: string, template: ResourceTemplate, readCallback: ReadResourceTemplateCallback): void;
    /**
     * Registers a resource `name` with a template pattern and metadata, which will use the given callback to respond to read requests.
     */
    resource(name: string, template: ResourceTemplate, metadata: ResourceMetadata, readCallback: ReadResourceTemplateCallback): void;
    /**
     * Registers a zero-argument tool `name`, which will run the given function when the client calls it.
     */
    tool(name: string, cb: ToolCallback): void;
    /**
     * Registers a zero-argument tool `name` (with a description) which will run the given function when the client calls it.
     */
    tool(name: string, description: string, cb: ToolCallback): void;
    /**
     * Registers a tool `name` accepting the given arguments, which must be an object containing named properties associated with Zod schemas. When the client calls it, the function will be run with the parsed and validated arguments.
     */
    tool<Args extends ZodRawShape>(name: string, paramsSchema: Args, cb: ToolCallback<Args>): void;
    /**
     * Registers a tool `name` (with a description) accepting the given arguments, which must be an object containing named properties associated with Zod schemas. When the client calls it, the function will be run with the parsed and validated arguments.
     */
    tool<Args extends ZodRawShape>(name: string, description: string, paramsSchema: Args, cb: ToolCallback<Args>): void;
    /**
     * Registers a zero-argument prompt `name`, which will run the given function when the client calls it.
     */
    prompt(name: string, cb: PromptCallback): void;
    /**
     * Registers a zero-argument prompt `name` (with a description) which will run the given function when the client calls it.
     */
    prompt(name: string, description: string, cb: PromptCallback): void;
    /**
     * Registers a prompt `name` accepting the given arguments, which must be an object containing named properties associated with Zod schemas. When the client calls it, the function will be run with the parsed and validated arguments.
     */
    prompt<Args extends PromptArgsRawShape>(name: string, argsSchema: Args, cb: PromptCallback<Args>): void;
    /**
     * Registers a prompt `name` (with a description) accepting the given arguments, which must be an object containing named properties associated with Zod schemas. When the client calls it, the function will be run with the parsed and validated arguments.
     */
    prompt<Args extends PromptArgsRawShape>(name: string, description: string, argsSchema: Args, cb: PromptCallback<Args>): void;
}
/**
 * A callback to complete one variable within a resource template's URI template.
 */
export type CompleteResourceTemplateCallback = (value: string) => string[] | Promise<string[]>;
/**
 * A resource template combines a URI pattern with optional functionality to enumerate
 * all resources matching that pattern.
 */
export declare class ResourceTemplate {
    private _callbacks;
    private _uriTemplate;
    constructor(uriTemplate: string | UriTemplate, _callbacks: {
        /**
         * A callback to list all resources matching this template. This is required to specified, even if `undefined`, to avoid accidentally forgetting resource listing.
         */
        list: ListResourcesCallback | undefined;
        /**
         * An optional callback to autocomplete variables within the URI template. Useful for clients and users to discover possible values.
         */
        complete?: {
            [variable: string]: CompleteResourceTemplateCallback;
        };
    });
    /**
     * Gets the URI template pattern.
     */
    get uriTemplate(): UriTemplate;
    /**
     * Gets the list callback, if one was provided.
     */
    get listCallback(): ListResourcesCallback | undefined;
    /**
     * Gets the callback for completing a specific URI template variable, if one was provided.
     */
    completeCallback(variable: string): CompleteResourceTemplateCallback | undefined;
}
/**
 * Callback for a tool handler registered with Server.tool().
 *
 * Parameters will include tool arguments, if applicable, as well as other request handler context.
 */
export type ToolCallback<Args extends undefined | ZodRawShape = undefined> = Args extends ZodRawShape ? (args: z.objectOutputType<Args, ZodTypeAny>, extra: RequestHandlerExtra) => CallToolResult | Promise<CallToolResult> : (extra: RequestHandlerExtra) => CallToolResult | Promise<CallToolResult>;
/**
 * Additional, optional information for annotating a resource.
 */
export type ResourceMetadata = Omit<Resource, "uri" | "name">;
/**
 * Callback to list all resources matching a given template.
 */
export type ListResourcesCallback = (extra: RequestHandlerExtra) => ListResourcesResult | Promise<ListResourcesResult>;
/**
 * Callback to read a resource at a given URI.
 */
export type ReadResourceCallback = (uri: URL, extra: RequestHandlerExtra) => ReadResourceResult | Promise<ReadResourceResult>;
/**
 * Callback to read a resource at a given URI, following a filled-in URI template.
 */
export type ReadResourceTemplateCallback = (uri: URL, variables: Variables, extra: RequestHandlerExtra) => ReadResourceResult | Promise<ReadResourceResult>;
type PromptArgsRawShape = {
    [k: string]: ZodType<string, ZodTypeDef, string> | ZodOptional<ZodType<string, ZodTypeDef, string>>;
};
export type PromptCallback<Args extends undefined | PromptArgsRawShape = undefined> = Args extends PromptArgsRawShape ? (args: z.objectOutputType<Args, ZodTypeAny>, extra: RequestHandlerExtra) => GetPromptResult | Promise<GetPromptResult> : (extra: RequestHandlerExtra) => GetPromptResult | Promise<GetPromptResult>;
export {};
//# sourceMappingURL=mcp.d.ts.map