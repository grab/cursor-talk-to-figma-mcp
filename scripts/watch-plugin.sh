#!/bin/bash

# Set directory to watch
PLUGIN_DIR="./src/cursor_mcp_plugin"
echo "🔍 Watching for changes in: $PLUGIN_DIR"
echo "Press Ctrl+C to stop watching..."

# If fswatch is not installed, provide installation guidance
if ! command -v fswatch &> /dev/null; then
    echo "fswatch is not installed. For better performance, please install it:"
    echo "  - macOS: brew install fswatch"
    echo "  - Linux: use your package manager to install fswatch"
    echo "Using basic file watching with find..."
    
    # Use basic find command for file change detection if fswatch is not available
    LAST_MODIFIED=$(find "$PLUGIN_DIR" -type f -name "*.js" -o -name "*.html" -o -name "*.json" -exec stat -f "%m" {} \; | sort -n | tail -1)
    
    while true; do
        sleep 2
        NEW_MODIFIED=$(find "$PLUGIN_DIR" -type f -name "*.js" -o -name "*.html" -o -name "*.json" -exec stat -f "%m" {} \; | sort -n | tail -1)
        
        if [ "$NEW_MODIFIED" != "$LAST_MODIFIED" ]; then
            TIMESTAMP=$(date +"%T")
            echo -e "\033[32m[$TIMESTAMP] Detected changes in plugin files\033[0m"
            LAST_MODIFIED=$NEW_MODIFIED
        fi
    done
else
    # Use fswatch for file change detection (more efficient)
    fswatch -o "$PLUGIN_DIR" --include '\.js$' --include '\.html$' --include '\.json$' | while read -r file; do
        TIMESTAMP=$(date +"%T")
        echo -e "\033[32m[$TIMESTAMP] File changed: $file\033[0m"
        
        # You can add additional actions here if needed
        # Example: auto-build plugin or run other scripts
    done
fi 