#!/bin/bash

# Ports to check
IMAGE_SERVER_PORT=3056
SOCKET_PORT=3055

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "Checking if required ports are available..."

# Function to check if port is in use
check_port() {
  local port=$1
  local service_name=$2
  
  # Check if port is in use
  if lsof -i :$port -t &> /dev/null; then
    echo -e "${YELLOW}WARNING: Port $port ($service_name) is already in use!${NC}"
    
    # Get PID using the port
    pid=$(lsof -i :$port -t)
    process_name=$(ps -p $pid -o comm=)
    
    echo -e "Port $port is being used by process: ${RED}$process_name ($pid)${NC}"
    
    # Ask user what to do
    echo -e "Options:"
    echo "  1) Kill the process and free up the port (recommended)"
    echo "  2) Continue anyway (may cause errors)"
    echo "  3) Exit"
    
    read -p "Your choice (1-3): " choice
    
    case $choice in
      1)
        echo "Attempting to kill process $pid..."
        kill -9 $pid 2> /dev/null
        sleep 1
        if ! lsof -i :$port -t &> /dev/null; then
          echo -e "${GREEN}Port $port is now available!${NC}"
          return 0
        else
          echo -e "${RED}Failed to free up port $port. Please close the application manually.${NC}"
          return 1
        fi
        ;;
      2)
        echo -e "${YELLOW}Continuing with port $port in use. This might cause errors.${NC}"
        return 0
        ;;
      3)
        echo "Exiting..."
        exit 1
        ;;
      *)
        echo -e "${RED}Invalid choice. Exiting...${NC}"
        exit 1
        ;;
    esac
  else
    echo -e "${GREEN}Port $port ($service_name) is available.${NC}"
    return 0
  fi
}

# Check each required port
check_port $IMAGE_SERVER_PORT "Image Server" || exit 1
check_port $SOCKET_PORT "WebSocket Server" || exit 1

echo -e "${GREEN}All required ports are available.${NC}"
echo "Starting services..." 