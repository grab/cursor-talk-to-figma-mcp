#!/usr/bin/env bun

import { Server, ServerWebSocket } from "bun";

// Store clients by channel
const channels = new Map<string, Set<ServerWebSocket<any>>>();

function handleConnection(ws: ServerWebSocket<any>) {
  // Don't add to clients immediately - wait for channel join
  console.log("New client connected");

  // Send welcome message to the new client
  ws.send(JSON.stringify({
    type: "system",
    message: "Please join a channel to start chatting",
  }));

  ws.close = () => {
    console.log("Client disconnected");

    // Remove client from their channel
    channels.forEach((clients, channelName) => {
      if (clients.has(ws)) {
        clients.delete(ws);

        // Notify other clients in same channel
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "system",
              message: "A user has left the channel",
              channel: channelName
            }));
          }
        });
      }
    });
  };
}

// Origins allowed to talk to this relay from a browser. The relay listens on
// localhost, but browsers will happily open a WebSocket to localhost for any
// web page the user visits, so the Origin header is the only thing that
// separates the intended clients from an arbitrary web origin.
//
// Intended browser client: the Figma plugin UI. It runs in a sandboxed
// iframe and sends `Origin: null`; on the web it may also appear as a
// figma.com origin. The other intended clients (the MCP server, curl, ...)
// are not browsers and send no Origin header at all, so a missing header is
// allowed. Extra origins can be allowlisted with the ALLOWED_ORIGINS
// environment variable (comma-separated, exact serialized origins).
const extraAllowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

export function isOriginAllowed(origin: string | null): boolean {
  // Non-browser clients (MCP server, curl, ...) send no Origin header.
  if (origin === null) return true;
  // Figma plugin UI: sandboxed iframe with an opaque origin.
  if (origin === "null") return true;
  if (extraAllowedOrigins.has(origin)) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  if (hostname === "figma.com" || hostname.endsWith(".figma.com")) {
    return true;
  }
  return false;
}

// CORS headers for a response: echo the origin back only when it is
// allowlisted, instead of the previous wildcard.
export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin !== null && isOriginAllowed(origin)) {
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return {};
}

export function startRelayServer(port = 3055) {
  return Bun.serve({
    port,
    // uncomment this to allow connections in windows wsl
    // hostname: "0.0.0.0",
    fetch(req: Request, server: Server) {
      const origin = req.headers.get("origin");

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        if (origin !== null && !isOriginAllowed(origin)) {
          return new Response("Forbidden", { status: 403 });
        }
        return new Response(null, {
          headers: {
            ...corsHeaders(origin),
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }

      // Handle WebSocket upgrade. Browsers always send an Origin header on a
      // WebSocket handshake, so reject untrusted origins before upgrading:
      // otherwise any web page could drive this local relay.
      if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        if (!isOriginAllowed(origin)) {
          return new Response("Forbidden", { status: 403 });
        }

        const success = server.upgrade(req, {
          headers: corsHeaders(origin),
        });

        if (success) {
          return; // Upgraded to WebSocket
        }
      }

      // Return response for non-WebSocket requests
      return new Response("WebSocket server running", {
        headers: corsHeaders(origin),
      });
    },
    websocket: {
      open: handleConnection,
      message(ws: ServerWebSocket<any>, message: string | Buffer) {
        try {
          const data = JSON.parse(message as string);
          console.log(`\n=== Received message from client ===`);
          console.log(`Type: ${data.type}, Channel: ${data.channel || 'N/A'}`);
          if (data.message?.command) {
            console.log(`Command: ${data.message.command}, ID: ${data.id}`);
          } else if (data.message?.result) {
            console.log(`Response: ID: ${data.id}, Has Result: ${!!data.message.result}`);
          }
          console.log(`Full message:`, JSON.stringify(data, null, 2));

          if (data.type === "join") {
            const channelName = data.channel;
            if (!channelName || typeof channelName !== "string") {
              ws.send(JSON.stringify({
                type: "error",
                message: "Channel name is required"
              }));
              return;
            }

            // Create channel if it doesn't exist
            if (!channels.has(channelName)) {
              channels.set(channelName, new Set());
            }

            // Add client to channel
            const channelClients = channels.get(channelName)!;
            channelClients.add(ws);

            console.log(`\n✓ Client joined channel "${channelName}" (${channelClients.size} total clients)`);

            // Notify client they joined successfully
            ws.send(JSON.stringify({
              type: "system",
              message: `Joined channel: ${channelName}`,
              channel: channelName
            }));

            ws.send(JSON.stringify({
              type: "system",
              message: {
                id: data.id,
                result: "Connected to channel: " + channelName,
              },
              channel: channelName
            }));

            // Notify other clients in channel
            channelClients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: "system",
                  message: "A new user has joined the channel",
                  channel: channelName
                }));
              }
            });
            return;
          }

          // Handle regular messages
          if (data.type === "message") {
            const channelName = data.channel;
            if (!channelName || typeof channelName !== "string") {
              ws.send(JSON.stringify({
                type: "error",
                message: "Channel name is required"
              }));
              return;
            }

            const channelClients = channels.get(channelName);
            if (!channelClients || !channelClients.has(ws)) {
              ws.send(JSON.stringify({
                type: "error",
                message: "You must join the channel first"
              }));
              return;
            }

            // Broadcast to all OTHER clients in the channel (not the sender)
            // This prevents echo and ensures proper request-response flow
            let broadcastCount = 0;
            channelClients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                broadcastCount++;
                const broadcastMessage = {
                  type: "broadcast",
                  message: data.message,
                  sender: "peer",
                  channel: channelName
                };
                console.log(`\n=== Broadcasting to peer #${broadcastCount} ===`);
                console.log(JSON.stringify(broadcastMessage, null, 2));
                client.send(JSON.stringify(broadcastMessage));
              }
            });
          
            if (broadcastCount === 0) {
              console.log(`⚠️  No other clients in channel "${channelName}" to receive message!`);
            } else {
              console.log(`✓ Broadcast to ${broadcastCount} peer(s) in channel "${channelName}"`);
            }
          }

          // Forward progress_update messages to the MCP server so it can reset
          if (data.type === "progress_update") {
            const channelName = data.channel;
            if (!channelName) return;

            const channelClients = channels.get(channelName);
            if (!channelClients || !channelClients.has(ws)) return;

            channelClients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
              }
            });
          }
        } catch (err) {
          console.error("Error handling message:", err);
        }
      },
      close(ws: ServerWebSocket<any>) {
        // Remove client from their channel
        channels.forEach((clients) => {
          clients.delete(ws);
        });
      }
    }
  });
}

if (import.meta.main) {
  const server = startRelayServer();
  console.log(`WebSocket server running on port ${server.port}`);
}
