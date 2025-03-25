import { watch } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';

const pluginDir = join(process.cwd(), 'src', 'cursor_mcp_plugin');
console.log(`🔍 Watching for changes in: ${pluginDir}`);
console.log('Press Ctrl+C to stop watching...');

// Prevent duplicate notifications
let debounceTimer;
const debounceTime = 500; // ms

// Watch the directory
watch(pluginDir, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  
  // Only watch .js, .html, and .json files
  if (!/\.(js|html|json)$/.test(filename)) return;
  
  // Debounce to prevent multiple notifications for the same change
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\x1b[32m[${timestamp}] File changed: ${filename}\x1b[0m`);
    
    // Optional: Add macOS notification
    if (process.platform === 'darwin') {
      exec(`osascript -e 'display notification "File: ${filename}" with title "Figma Plugin Changed"'`);
    }
    
    // You could add additional actions here if needed
    // For example, copying files or triggering a build process
  }, debounceTime);
});
