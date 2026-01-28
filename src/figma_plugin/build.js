#!/usr/bin/env node
/**
 * Build script for Figma plugin
 * Uses esbuild to bundle all modules into a single code.js file
 */

import * as esbuild from 'esbuild';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');

async function build() {
    const ctx = await esbuild.context({
        entryPoints: [join(__dirname, 'src/main.js')],
        bundle: true,
        outfile: join(__dirname, 'code.js'),
        format: 'iife',
        target: ['es2020'],
        platform: 'browser',
        minify: false,
        sourcemap: false,
        logLevel: 'info',
    });

    if (isWatch) {
        await ctx.watch();
        console.log('Watching for changes...');
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log('Build complete!');
    }
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
