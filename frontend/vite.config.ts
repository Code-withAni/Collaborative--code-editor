import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createExpressApp, setupSocketIO } from "./server";
import { Server as SocketIOServer } from "socket.io";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./client", "./shared", "index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  let io: SocketIOServer | null = null;

  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createExpressApp();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);

      // Attach Socket.io to the Vite dev server's underlying HTTP server
      return () => {
        if (server.httpServer && !io) {
          io = new SocketIOServer(server.httpServer, {
            cors: {
              origin: "*",
              methods: ["GET", "POST"],
            },
          });
          setupSocketIO(io);
          console.log("Socket.io attached to dev server");
        }
      };
    },
  };
}
