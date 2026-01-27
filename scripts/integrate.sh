#!/bin/bash

# Integration configuration script for Figma Edit MCP
# Configure MCP for various AI coding assistants

# Get the absolute path to this project
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$SCRIPT_DIR" )"

# MCP configuration JSON - uses local installation
MCP_CONFIG="{\"FigmaEdit\":{\"command\":\"bun\",\"args\":[\"run\",\"$PROJECT_DIR/dist/server.js\"]}}"

echo "🤖 Figma Edit MCP Integration"
echo "========================================"
echo ""

# Function to install for Cursor
install_cursor() {
    CURSOR_CONFIG_DIR="$HOME/.cursor"
    CURSOR_CONFIG_FILE="$CURSOR_CONFIG_DIR/mcp.json"
    
    echo "📦 Configuring Cursor..."
    if [ -d "$CURSOR_CONFIG_DIR" ] || command -v cursor &> /dev/null; then
        mkdir -p "$CURSOR_CONFIG_DIR"
        
        # Check if file exists AND has valid JSON content
        NEEDS_NEW_FILE=true
        if [ -f "$CURSOR_CONFIG_FILE" ]; then
            EXISTING=$(cat "$CURSOR_CONFIG_FILE")
            if [ -n "$EXISTING" ] && echo "$EXISTING" | jq -e '.' > /dev/null 2>&1; then
                NEEDS_NEW_FILE=false
            fi
        fi
        
        if [ "$NEEDS_NEW_FILE" = true ]; then
            echo '{"mcpServers":'"$MCP_CONFIG"'}' > "$CURSOR_CONFIG_FILE"
            echo "✅ Created ~/.cursor/mcp.json"
        else
            if command -v jq &> /dev/null; then
                if echo "$EXISTING" | jq -e '.mcpServers' > /dev/null 2>&1; then
                    MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '.mcpServers += $new')
                else
                    MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '. + {"mcpServers": $new}')
                fi
                echo "$MERGED" > "$CURSOR_CONFIG_FILE"
                echo "✅ Updated ~/.cursor/mcp.json"
            else
                echo "⚠️  jq not found. Please manually update ~/.cursor/mcp.json"
            fi
        fi
    else
        echo "ℹ️  Cursor not detected."
    fi
}

# Function to install for VS Code / Copilot
install_vscode_mcp() {
    VSCODE_CONFIG_DIR="$HOME/Library/Application Support/Code/User"
    VSCODE_MCP_FILE="$VSCODE_CONFIG_DIR/mcp.json"
    
    echo "📦 Configuring VS Code (standard mcp.json)..."
    if [ -d "$VSCODE_CONFIG_DIR" ]; then
        # Check if file exists AND has valid JSON content
        NEEDS_NEW_FILE=true
        if [ -f "$VSCODE_MCP_FILE" ]; then
            EXISTING=$(cat "$VSCODE_MCP_FILE")
            if [ -n "$EXISTING" ] && echo "$EXISTING" | jq -e '.' > /dev/null 2>&1; then
                NEEDS_NEW_FILE=false
            fi
        fi
        
        if [ "$NEEDS_NEW_FILE" = true ]; then
            echo '{"servers":'"$MCP_CONFIG"'}' > "$VSCODE_MCP_FILE"
            echo "✅ Created VS Code mcp.json"
        else
            if command -v jq &> /dev/null; then
                if echo "$EXISTING" | jq -e '.servers' > /dev/null 2>&1; then
                    MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '.servers += $new')
                else
                    MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '. + {"servers": $new}')
                fi
                echo "$MERGED" > "$VSCODE_MCP_FILE"
                echo "✅ Updated VS Code mcp.json"
            else
                echo "⚠️  jq not found. Please manually update VS Code mcp.json"
            fi
        fi
    else
        echo "ℹ️  VS Code not detected."
    fi
}

# Function to install for Antigravity
install_antigravity() {
    ANTIGRAVITY_CONFIG_DIR="$HOME/.gemini/antigravity"
    ANTIGRAVITY_CONFIG_FILE="$ANTIGRAVITY_CONFIG_DIR/mcp_config.json"
    
    echo "📦 Configuring Antigravity..."
    mkdir -p "$ANTIGRAVITY_CONFIG_DIR"
    
    # Check if file exists AND has valid JSON content
    NEEDS_NEW_FILE=true
    if [ -f "$ANTIGRAVITY_CONFIG_FILE" ]; then
        EXISTING=$(cat "$ANTIGRAVITY_CONFIG_FILE")
        # Check if file is not empty and contains valid JSON
        if [ -n "$EXISTING" ] && echo "$EXISTING" | jq -e '.' > /dev/null 2>&1; then
            NEEDS_NEW_FILE=false
        fi
    fi
    
    if [ "$NEEDS_NEW_FILE" = true ]; then
        # Create new config file
        echo '{"mcpServers":'"$MCP_CONFIG"'}' > "$ANTIGRAVITY_CONFIG_FILE"
        echo "✅ Created ~/.gemini/antigravity/mcp_config.json"
    else
        # Merge with existing config
        if command -v jq &> /dev/null; then
            if echo "$EXISTING" | jq -e '.mcpServers' > /dev/null 2>&1; then
                MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '.mcpServers += $new')
            else
                MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '. + {"mcpServers": $new}')
            fi
            echo "$MERGED" > "$ANTIGRAVITY_CONFIG_FILE"
            echo "✅ Updated ~/.gemini/antigravity/mcp_config.json"
        else
            echo "⚠️  jq not found. Please manually update Antigravity config."
        fi
    fi
}

# Function to install for Claude Desktop
install_claude_desktop() {
    CLAUDE_CONFIG_DIR="$HOME/.config/claude"
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    
    echo "📦 Configuring Claude Desktop..."
    if [ -d "$CLAUDE_CONFIG_DIR" ] || [ -f "$CLAUDE_CONFIG_FILE" ]; then
        mkdir -p "$CLAUDE_CONFIG_DIR"
        
        # Check if file exists AND has valid JSON content
        NEEDS_NEW_FILE=true
        if [ -f "$CLAUDE_CONFIG_FILE" ]; then
            EXISTING=$(cat "$CLAUDE_CONFIG_FILE")
            if [ -n "$EXISTING" ] && echo "$EXISTING" | jq -e '.' > /dev/null 2>&1; then
                NEEDS_NEW_FILE=false
            fi
        fi
        
        if [ "$NEEDS_NEW_FILE" = true ]; then
            echo '{"mcpServers":'"$MCP_CONFIG"'}' > "$CLAUDE_CONFIG_FILE"
            echo "✅ Created Claude Desktop config"
        else
            if command -v jq &> /dev/null; then
                if echo "$EXISTING" | jq -e '.mcpServers' > /dev/null 2>&1; then
                    MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '.mcpServers += $new')
                else
                    MERGED=$(echo "$EXISTING" | jq --argjson new "$MCP_CONFIG" '. + {"mcpServers": $new}')
                fi
                echo "$MERGED" > "$CLAUDE_CONFIG_FILE"
                echo "✅ Updated Claude Desktop config"
            else
                echo "⚠️  jq not found. Please update config manually."
            fi
        fi
    else
        echo "ℹ️  Claude Desktop config not found."
    fi
}

# Function for Claude Code instructions
show_claude_code_instructions() {
    echo ""
    echo "📦 Claude Code CLI Instructions:"
    echo "To install for Claude Code, run the following command in your terminal:"
    echo ""
    echo "  claude mcp add FigmaEdit bun run $PROJECT_DIR/dist/server.js"
    echo ""
}

# Function to create local .mcp.json for Claude Code workspace config
install_claude_code_local() {
    LOCAL_MCP_FILE="$PROJECT_DIR/.mcp.json"
    
    echo "📦 Creating local .mcp.json for Claude Code..."
    
    cat > "$LOCAL_MCP_FILE" << EOF
{
    "mcpServers": {
        "FigmaEdit": {
            "command": "bun",
            "args": [
                "run",
                "$PROJECT_DIR/dist/server.js"
            ]
        }
    }
}
EOF
    echo "✅ Created $LOCAL_MCP_FILE"
    echo "   Claude Code will auto-discover this when you open this project."
}

# Interactive Menu
show_menu() {
    echo "Select an integration to configure:"
    echo ""
    echo "  1) Google Antigravity"
    echo "  2) VS Code / GitHub Copilot"
    echo "  3) Cursor"
    echo "  4) Claude Desktop"
    echo "  5) Claude Code (CLI command)"
    echo "  6) Claude Code (local .mcp.json)"
    echo ""
    echo "  q) Quit"
    echo ""
}

show_menu
read -p "Enter your choice: " choice
echo ""

case $choice in
    1)
        install_antigravity
        echo ""
        echo "⚠️  Please reload Google Antigravity to pick up the changes."
        ;;
    2)
        install_vscode_mcp
        echo ""
        echo "⚠️  Please reload VS Code to pick up the changes."
        ;;
    3)
        install_cursor
        echo ""
        echo "⚠️  Please reload Cursor to pick up the changes."
        ;;
    4)
        install_claude_desktop
        echo ""
        echo "⚠️  Please restart Claude Desktop to pick up the changes."
        ;;
    5)
        show_claude_code_instructions
        echo "After running the command above, Claude Code will be ready to use."
        ;;
    6)
        install_claude_code_local
        echo ""
        echo "⚠️  Please reload your IDE to pick up the changes."
        ;;
    q|Q)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option."
        exit 1
        ;;
esac

echo ""
echo "🎉 Done!"
