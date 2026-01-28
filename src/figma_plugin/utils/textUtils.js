/**
 * Text manipulation utilities for Figma plugin
 */

import { uniqBy } from './helpers.js';

/**
 * Gets delimiter positions in a string
 * @param {string} str - Input string
 * @param {string} delimiter - Delimiter character
 * @param {number} startIdx - Start index
 * @param {number} endIdx - End index
 * @returns {Array} Array of [start, end] position pairs
 */
export const getDelimiterPos = (str, delimiter, startIdx = 0, endIdx = str.length) => {
    const indices = [];
    let temp = startIdx;
    for (let i = startIdx; i < endIdx; i++) {
        if (
            str[i] === delimiter &&
            i + startIdx !== endIdx &&
            temp !== i + startIdx
        ) {
            indices.push([temp, i + startIdx]);
            temp = i + startIdx + 1;
        }
    }
    temp !== endIdx && indices.push([temp, endIdx]);
    return indices.filter(Boolean);
};

/**
 * Builds a linear order of fonts from a text node
 * @param {TextNode} node - Figma text node
 * @returns {Array} Array of font info objects
 */
export const buildLinearOrder = (node) => {
    const fontTree = [];
    const newLinesPos = getDelimiterPos(node.characters, "\n");
    newLinesPos.forEach(([newLinesRangeStart, newLinesRangeEnd], n) => {
        const newLinesRangeFont = node.getRangeFontName(
            newLinesRangeStart,
            newLinesRangeEnd
        );
        if (newLinesRangeFont === figma.mixed) {
            const spacesPos = getDelimiterPos(
                node.characters,
                " ",
                newLinesRangeStart,
                newLinesRangeEnd
            );
            spacesPos.forEach(([spacesRangeStart, spacesRangeEnd], s) => {
                const spacesRangeFont = node.getRangeFontName(
                    spacesRangeStart,
                    spacesRangeEnd
                );
                if (spacesRangeFont === figma.mixed) {
                    const spacesRangeFont = node.getRangeFontName(
                        spacesRangeStart,
                        spacesRangeStart[0]
                    );
                    fontTree.push({
                        start: spacesRangeStart,
                        delimiter: " ",
                        family: spacesRangeFont.family,
                        style: spacesRangeFont.style,
                    });
                } else {
                    fontTree.push({
                        start: spacesRangeStart,
                        delimiter: " ",
                        family: spacesRangeFont.family,
                        style: spacesRangeFont.style,
                    });
                }
            });
        } else {
            fontTree.push({
                start: newLinesRangeStart,
                delimiter: "\n",
                family: newLinesRangeFont.family,
                style: newLinesRangeFont.style,
            });
        }
    });
    return fontTree
        .sort((a, b) => +a.start - +b.start)
        .map(({ family, style, delimiter }) => ({ family, style, delimiter }));
};

/**
 * Sets characters on a text node with the main font strategy
 * @param {TextNode} node - Figma text node
 * @param {string} characters - New text content
 * @param {Object} options - Options including fallbackFont and smartStrategy
 * @returns {Promise<boolean>} Success status
 */
export const setCharacters = async (node, characters, options) => {
    const fallbackFont = (options && options.fallbackFont) || {
        family: "Inter",
        style: "Regular",
    };
    try {
        if (node.fontName === figma.mixed) {
            if (options && options.smartStrategy === "prevail") {
                const fontHashTree = {};
                for (let i = 1; i < node.characters.length; i++) {
                    const charFont = node.getRangeFontName(i - 1, i);
                    const key = `${charFont.family}::${charFont.style}`;
                    fontHashTree[key] = fontHashTree[key] ? fontHashTree[key] + 1 : 1;
                }
                const prevailedTreeItem = Object.entries(fontHashTree).sort(
                    (a, b) => b[1] - a[1]
                )[0];
                const [family, style] = prevailedTreeItem[0].split("::");
                const prevailedFont = {
                    family,
                    style,
                };
                await figma.loadFontAsync(prevailedFont);
                node.fontName = prevailedFont;
            } else if (options && options.smartStrategy === "strict") {
                return setCharactersWithStrictMatchFont(node, characters, fallbackFont);
            } else if (options && options.smartStrategy === "experimental") {
                return setCharactersWithSmartMatchFont(node, characters, fallbackFont);
            } else {
                const firstCharFont = node.getRangeFontName(0, 1);
                await figma.loadFontAsync(firstCharFont);
                node.fontName = firstCharFont;
            }
        } else {
            await figma.loadFontAsync({
                family: node.fontName.family,
                style: node.fontName.style,
            });
        }
    } catch (err) {
        console.warn(
            `Failed to load "${node.fontName["family"]} ${node.fontName["style"]}" font and replaced with fallback "${fallbackFont.family} ${fallbackFont.style}"`,
            err
        );
        await figma.loadFontAsync(fallbackFont);
        node.fontName = fallbackFont;
    }
    try {
        node.characters = characters;
        return true;
    } catch (err) {
        console.warn(`Failed to set characters. Skipped.`, err);
        return false;
    }
};

/**
 * Sets characters with strict font matching
 * @param {TextNode} node - Figma text node
 * @param {string} characters - New text content
 * @param {Object} fallbackFont - Fallback font object
 * @returns {Promise<boolean>} Success status
 */
export const setCharactersWithStrictMatchFont = async (
    node,
    characters,
    fallbackFont
) => {
    const fontHashTree = {};
    for (let i = 1; i < node.characters.length; i++) {
        const startIdx = i - 1;
        const startCharFont = node.getRangeFontName(startIdx, i);
        const startCharFontVal = `${startCharFont.family}::${startCharFont.style}`;
        while (i < node.characters.length) {
            i++;
            const charFont = node.getRangeFontName(i - 1, i);
            if (startCharFontVal !== `${charFont.family}::${charFont.style}`) {
                break;
            }
        }
        fontHashTree[`${startIdx}_${i}`] = startCharFontVal;
    }
    await figma.loadFontAsync(fallbackFont);
    node.fontName = fallbackFont;
    node.characters = characters;
    console.log(fontHashTree);
    await Promise.all(
        Object.keys(fontHashTree).map(async (range) => {
            console.log(range, fontHashTree[range]);
            const [start, end] = range.split("_");
            const [family, style] = fontHashTree[range].split("::");
            const matchedFont = {
                family,
                style,
            };
            await figma.loadFontAsync(matchedFont);
            return node.setRangeFontName(Number(start), Number(end), matchedFont);
        })
    );
    return true;
};

/**
 * Sets characters with smart font matching (experimental)
 * @param {TextNode} node - Figma text node
 * @param {string} characters - New text content
 * @param {Object} fallbackFont - Fallback font object
 * @returns {Promise<boolean>} Success status
 */
export const setCharactersWithSmartMatchFont = async (
    node,
    characters,
    fallbackFont
) => {
    const rangeTree = buildLinearOrder(node);
    const fontsToLoad = uniqBy(
        rangeTree,
        ({ family, style }) => `${family}::${style}`
    ).map(({ family, style }) => ({
        family,
        style,
    }));

    await Promise.all([...fontsToLoad, fallbackFont].map(figma.loadFontAsync));

    node.fontName = fallbackFont;
    node.characters = characters;

    let prevPos = 0;
    rangeTree.forEach(({ family, style, delimiter }) => {
        if (prevPos < node.characters.length) {
            const delimeterPos = node.characters.indexOf(delimiter, prevPos);
            const endPos =
                delimeterPos > prevPos ? delimeterPos : node.characters.length;
            const matchedFont = {
                family,
                style,
            };
            node.setRangeFontName(prevPos, endPos, matchedFont);
            prevPos = endPos + 1;
        }
    });
    return true;
};
