/**
 * General helper utilities for Figma plugin
 */

/**
 * Returns an array with unique items based on a predicate
 * @param {Array} arr - Input array
 * @param {Function|string} predicate - Function or property name to determine uniqueness
 * @returns {Array} Array with unique items
 */
export function uniqBy(arr, predicate) {
    const cb = typeof predicate === "function" ? predicate : (o) => o[predicate];
    return [
        ...arr
            .reduce((map, item) => {
                const key = item === null || item === undefined ? item : cb(item);

                map.has(key) || map.set(key, item);

                return map;
            }, new Map())
            .values(),
    ];
}

/**
 * Creates a promise that resolves after specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
