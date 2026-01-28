/**
 * Progress update utilities for Figma plugin
 */

/**
 * Generates a unique command ID for tracking operations
 * @returns {string} Unique command ID
 */
export function generateCommandId() {
    return (
        "cmd_" +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    );
}

/**
 * Sends a progress update to the UI
 * @param {string} commandId - Unique command identifier
 * @param {string} commandType - Type of command being executed
 * @param {string} status - Current status (started, in_progress, completed, error)
 * @param {number} progress - Progress percentage (0-1)
 * @param {number} totalItems - Total number of items to process
 * @param {number} processedItems - Number of items processed
 * @param {string} message - Human-readable progress message
 * @param {Object|null} payload - Optional additional data
 * @returns {Object} The update object that was sent
 */
export function sendProgressUpdate(
    commandId,
    commandType,
    status,
    progress,
    totalItems,
    processedItems,
    message,
    payload = null
) {
    const update = {
        type: "command_progress",
        commandId,
        commandType,
        status,
        progress,
        totalItems,
        processedItems,
        message,
        timestamp: Date.now(),
    };

    // Add optional chunk information if present
    if (payload) {
        if (
            payload.currentChunk !== undefined &&
            payload.totalChunks !== undefined
        ) {
            update.currentChunk = payload.currentChunk;
            update.totalChunks = payload.totalChunks;
            update.chunkSize = payload.chunkSize;
        }
        update.payload = payload;
    }

    // Send to UI
    figma.ui.postMessage(update);
    console.log(`Progress update: ${status} - ${progress}% - ${message}`);

    return update;
}
