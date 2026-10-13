import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createRepoHandler } from "./api/create-repo.js";
import { validateTokenHandler } from "./api/validate-token.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API routes
app.post("/api/create-repo", createRepoHandler);
app.post("/api/validate-token", validateTokenHandler);

// Serve static files from the Vite build output
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback — semua route lain kembali ke index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Zip2Repo server running on port ${PORT}`);
});
