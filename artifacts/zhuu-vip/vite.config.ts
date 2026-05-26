import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(async ({ command }) => {
  const isDev = command === "serve";
  const basePath = process.env.BASE_PATH ?? "/";
  const apiPort = process.env.API_PORT ?? "8080";

  let port: number | undefined;
  if (isDev) {
    const rawPort = process.env.PORT;
    if (!rawPort) {
      throw new Error("PORT environment variable is required in dev mode.");
    }
    port = Number(rawPort);
    if (Number.isNaN(port) || port <= 0) {
      throw new Error(`Invalid PORT value: "${rawPort}"`);
    }
  }

  const plugins: any[] = [react(), tailwindcss({ optimize: false })];

  if (isDev && process.env.REPL_ID !== undefined) {
    const { default: runtimeErrorOverlay } = await import("@replit/vite-plugin-runtime-error-modal");
    plugins.push(runtimeErrorOverlay());
    if (process.env.NODE_ENV !== "production") {
      plugins.push(
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
      );
    }
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            clerk: ["@clerk/react"],
            query: ["@tanstack/react-query"],
          },
        },
      },
    },
    server: isDev
      ? {
          port,
          strictPort: true,
          host: "0.0.0.0",
          allowedHosts: true,
          fs: { strict: true },
          proxy: {
            "/api": {
              target: `http://localhost:${apiPort}`,
              changeOrigin: true,
            },
          },
        }
      : undefined,
    preview: {
      port: port ?? 3000,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
