// src/figma_plugin/handlers/variableHandlers.js

import { filterFigmaNode } from "../utils/nodeUtils";

export async function getVariables(params) {
    const { variableId } = params || {};

    try {
        // Lookup Mode (if variableId is provided)
        if (variableId) {
            const variable = await figma.variables.getVariableByIdAsync(variableId);
            if (!variable) {
                return null;
            }

            // Resolve collection for context
            const collection = await figma.variables.getVariableCollectionByIdAsync(
                variable.variableCollectionId
            );

            return {
                id: variable.id,
                name: variable.name,
                key: variable.key,
                type: variable.resolvedType, // COLOR, FLOAT, STRING, BOOLEAN
                description: variable.description,
                collectionId: variable.variableCollectionId,
                collectionName: collection ? collection.name : "Unknown",
                remote: variable.remote,
                scopes: variable.scopes,
                valuesByMode: variable.valuesByMode, // { modeId: value }
            };
        }

        // List All Mode (Discovery)
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const variables = await figma.variables.getLocalVariablesAsync();

        // Transform Collections
        const mappedCollections = collections.map((c) => ({
            id: c.id,
            name: c.name,
            key: c.key,
            modes: c.modes, // [{ modeId, name }, ...]
            defaultModeId: c.defaultModeId,
            remote: c.remote,
            variableIds: c.variableIds,
        }));

        // Transform Variables
        const mappedVariables = variables.map((v) => ({
            id: v.id,
            name: v.name,
            key: v.key,
            type: v.resolvedType,
            collectionId: v.variableCollectionId,
            valuesByMode: v.valuesByMode,
            description: v.description,
        }));

        return {
            collections: mappedCollections,
            variables: mappedVariables,
        };
    } catch (err) {
        throw new Error(`Error getting variables: ${err.message}`);
    }
}

export async function getNodeVariables(params) {
    const { nodeId } = params || {};
    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    // 1. Get Bound Variables (individual properties)
    const boundVariables = node.boundVariables || {};

    // 2. Get Explicit Variable Modes (theme settings)
    const explicitVariableModes = node.explicitVariableModes || {};

    // Resolve mode names (optional, but helpful)
    const resolvedModes = {};
    if (Object.keys(explicitVariableModes).length > 0) {
        try {
            const collections = await Promise.all(
                Object.keys(explicitVariableModes).map(id => figma.variables.getVariableCollectionByIdAsync(id))
            );

            collections.forEach(collection => {
                if (collection) {
                    const modeId = explicitVariableModes[collection.id];
                    const mode = collection.modes.find(m => m.modeId === modeId);
                    resolvedModes[collection.id] = {
                        collectionName: collection.name,
                        modeId: modeId,
                        modeName: mode ? mode.name : "Unknown Mode"
                    }
                }
            })
        } catch (e) {
            // ignore resolution errors
        }
    }

    // 3. Helper to look up variable details for bound variables
    const resolvedBindings = {};
    for (const [field, alias] of Object.entries(boundVariables)) {
        // boundVariables can be nested (e.g. for fills/strokes/componentProperties)
        // or simple Alias (id, type)
        // Simple handling for now: if it has an id, try to resolve name
        if (alias && alias.id) {
            try {
                const v = await figma.variables.getVariableByIdAsync(alias.id);
                resolvedBindings[field] = {
                    variableId: alias.id,
                    variableName: v ? v.name : "Unknown Variable"
                }
            } catch (e) {
                resolvedBindings[field] = alias;
            }
        } else {
            // complex bindings (arrays etc) - keep raw
            resolvedBindings[field] = alias;
        }
    }

    return {
        nodeId: node.id,
        name: node.name,
        boundVariables: resolvedBindings, // enriched with names where possible
        rawBoundVariables: boundVariables, // raw data
        explicitVariableModes,
        resolvedExplicitModes: resolvedModes
    };
}

export async function setBoundVariable(params) {
    const { nodeId, field, variableId, collectionId, modeId } = params || {};

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    // Case A: Set Explicit Mode (Theming)
    if (collectionId !== undefined) {
        if (modeId === undefined) {
            throw new Error("Missing modeId when setting collection mode");
        }
        try {
            // If modeId is null/empty string, we clear the mode?
            // Plugin API: setExplicitVariableModeForCollection(collectionId, modeId)
            // To clear, we usually don't have a clear method, but passing invalid mode might throw.
            // Let's assume user sends valid modeId.
            await node.setExplicitVariableModeForCollection(collectionId, modeId);
            return { success: true, message: `Set mode ${modeId} for collection ${collectionId}` };
        } catch (e) {
            throw new Error(`Failed to set explicit variable mode: ${e.message}`);
        }
    }

    // Case B: Set Bound Variable (Property)
    if (field) {
        // variableId can be null to unbind
        try {
            if (variableId) {
                const variable = await figma.variables.getVariableByIdAsync(variableId);
                if (!variable) throw new Error(`Variable ${variableId} not found`);

                node.setBoundVariable(field, variable);
                return { success: true, message: `Bound ${field} to variable ${variable.name}` };
            } else {
                // Unbind
                node.setBoundVariable(field, null);
                return { success: true, message: `Unbound variable from ${field}` };
            }
        } catch (e) {
            throw new Error(`Failed to set bound variable: ${e.message}`);
        }
    }

    throw new Error("Must provide either (field + variableId) or (collectionId + modeId)");
}
