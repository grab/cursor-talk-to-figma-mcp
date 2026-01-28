/**
 * Color utility functions for Figma plugin
 */

/**
 * Converts RGBA color object to hex string
 * @param {Object} color - Color object with r, g, b (0-1) and optional a
 * @returns {string} Hex color string (e.g., "#ff0000" or "#ff0000ff")
 */
export function rgbaToHex(color) {
    var r = Math.round(color.r * 255);
    var g = Math.round(color.g * 255);
    var b = Math.round(color.b * 255);
    var a = color.a !== undefined ? Math.round(color.a * 255) : 255;

    if (a === 255) {
        return (
            "#" +
            [r, g, b]
                .map((x) => {
                    return x.toString(16).padStart(2, "0");
                })
                .join("")
        );
    }

    return (
        "#" +
        [r, g, b, a]
            .map((x) => {
                return x.toString(16).padStart(2, "0");
            })
            .join("")
    );
}
