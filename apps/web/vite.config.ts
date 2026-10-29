import { fileURLToPath, URL } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command, mode }) => ({
  define: { "import.meta.env.VITE_LOCAL_PILOT": JSON.stringify(command === "serve" && mode !== "test") },
  plugins: [react(), tailwindcss(), {
    name: "local-real-pilot",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__local/pilot", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        if (req.method !== "GET" || !/^(127\.0\.0\.1|localhost):5173$/.test(req.headers.host || "")) { res.statusCode = 403; res.end('{}'); return; }
        try {
          const root = fileURLToPath(new URL("../../.m05-stage", import.meta.url));
          const folders = readdirSync(root).filter(name => name.startsWith("pilot-100-"));
          if (folders.length !== 1) throw new Error("Piloto indisponível");
          const records = readFileSync(join(root, folders[0], "records.ndjson"), "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line) as Record<string, unknown>);
          if (records.length !== 100) throw new Error("Piloto inválido");
          const fields = ["cnpj", "nome", "razao_social", "uf", "cidade", "cnae", "bairro", "endereco"];
          const items = records.map((record, index) => ({ ...Object.fromEntries(fields.map(field => [field, record[field] ?? null])), id: index + 1, status: null, responsavel: null }));
          const uf = new URL(req.url || "/", "http://localhost").searchParams.get("uf");
          res.end(JSON.stringify({ items: uf ? items.filter(row => (row as Record<string, unknown>).uf === uf) : items, next_after_id: null }));
        } catch { res.statusCode = 503; res.end(JSON.stringify({ error: "Arquivo real do piloto indisponível." })); }
      });
    },
  }],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.tsx"],
  },
}));
