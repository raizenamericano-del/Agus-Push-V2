/** Galeri template starter — bikin repo tanpa file ZIP.
 *  PENTING: isi `content` tidak boleh mengandung backtick / ${ mentah.
 */

export const TEMPLATES = [
  {
    id: "react-vite",
    icon: "⚛️",
    name: "React + Vite",
    desc: "Starter frontend React modern dengan Vite. Siap deploy ke Vercel/Netlify.",
    tags: ["frontend", "javascript"],
    files: [
      {
        path: "package.json",
        content:
          '{\n  "name": "my-react-app",\n  "private": true,\n  "version": "1.0.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.3.1",\n    "vite": "^5.3.4"\n  }\n}\n',
      },
      {
        path: "vite.config.js",
        content:
          'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n',
      },
      {
        path: "index.html",
        content:
          '<!doctype html>\n<html lang="id">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>My React App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n',
      },
      {
        path: "src/main.jsx",
        content:
          'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App.jsx";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n',
      },
      {
        path: "src/App.jsx",
        content:
          'export default function App() {\n  return (\n    <main style={{ fontFamily: "system-ui", textAlign: "center", padding: "4rem 1rem" }}>\n      <h1>Halo dari React + Vite ⚛️</h1>\n      <p>Edit src/App.jsx lalu simpan untuk melihat perubahan.</p>\n    </main>\n  );\n}\n',
      },
      {
        path: "src/index.css",
        content:
          "body { margin: 0; background: #0f172a; color: #e2e8f0; }\n",
      },
      {
        path: ".gitignore",
        content: "node_modules\ndist\n.env\n.DS_Store\n",
      },
      {
        path: "README.md",
        content:
          "# My React App\n\nStarter React + Vite.\n\n## Jalankan\n\n```bash\nnpm install\nnpm run dev\n```\n\nDibuat dengan Zip2Repo ⚡\n",
      },
    ],
  },
  {
    id: "express-api",
    icon: "🚂",
    name: "Express REST API",
    desc: "Backend Node.js + Express siap pakai dengan contoh endpoint CRUD.",
    tags: ["backend", "javascript"],
    files: [
      {
        path: "package.json",
        content:
          '{\n  "name": "my-express-api",\n  "version": "1.0.0",\n  "type": "module",\n  "main": "server.js",\n  "scripts": {\n    "start": "node server.js",\n    "dev": "node --watch server.js"\n  },\n  "dependencies": {\n    "cors": "^2.8.5",\n    "express": "^4.21.0"\n  }\n}\n',
      },
      {
        path: "server.js",
        content:
          'import express from "express";\nimport cors from "cors";\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(cors());\napp.use(express.json());\n\nconst items = [{ id: 1, name: "Contoh item" }];\n\napp.get("/", (req, res) => {\n  res.json({ status: "ok", message: "API berjalan 🚀" });\n});\n\napp.get("/api/items", (req, res) => res.json(items));\n\napp.post("/api/items", (req, res) => {\n  const item = { id: Date.now(), name: req.body.name || "Tanpa nama" };\n  items.push(item);\n  res.status(201).json(item);\n});\n\napp.listen(PORT, () => console.log("API jalan di port " + PORT));\n',
      },
      {
        path: ".gitignore",
        content: "node_modules\n.env\n.DS_Store\n",
      },
      {
        path: "README.md",
        content:
          "# My Express API\n\nREST API sederhana dengan Express.\n\n## Jalankan\n\n```bash\nnpm install\nnpm run dev\n```\n\nDibuat dengan Zip2Repo ⚡\n",
      },
    ],
  },
  {
    id: "python-app",
    icon: "🐍",
    name: "Python App",
    desc: "Proyek Python bersih dengan struktur package, requirements, dan contoh CLI.",
    tags: ["backend", "python"],
    files: [
      {
        path: "main.py",
        content:
          '"""Entry point aplikasi."""\n\nfrom app import __version__, sapa\n\n\ndef main():\n    print("Python App v" + __version__)\n    print(sapa("Dunia"))\n\n\nif __name__ == "__main__":\n    main()\n',
      },
      {
        path: "app/__init__.py",
        content: '__version__ = "1.0.0"\n\n\ndef sapa(nama):\n    return "Halo, " + nama + "! 👋"\n',
      },
      {
        path: "requirements.txt",
        content: "# Tambahkan dependency di sini, contoh:\n# requests==2.32.3\n",
      },
      {
        path: ".gitignore",
        content: "__pycache__/\n*.pyc\n.venv/\nvenv/\n.env\n.DS_Store\n",
      },
      {
        path: "README.md",
        content:
          "# Python App\n\nProyek Python sederhana.\n\n## Jalankan\n\n```bash\npython -m venv .venv\nsource .venv/bin/activate\npip install -r requirements.txt\npython main.py\n```\n\nDibuat dengan Zip2Repo ⚡\n",
      },
    ],
  },
  {
    id: "landing-page",
    icon: "🌐",
    name: "Landing Page HTML",
    desc: "Landing page statis satu folder: HTML + CSS + JS. Tinggal deploy.",
    tags: ["frontend", "html"],
    files: [
      {
        path: "index.html",
        content:
          '<!doctype html>\n<html lang="id">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Landing Page Saya</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <main class="hero">\n    <h1>Selamat Datang 🚀</h1>\n    <p>Landing page super ringan tanpa framework.</p>\n    <button id="btn">Klik saya</button>\n    <p id="msg"></p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n',
      },
      {
        path: "styles.css",
        content:
          "* { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }\n.hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; padding: 2rem; }\nh1 { font-size: 3rem; margin: 0; }\nbutton { padding: 0.75rem 2rem; font-size: 1rem; border: 0; border-radius: 999px; cursor: pointer; background: #6366f1; color: white; }\nbutton:hover { background: #4f46e5; }\n",
      },
      {
        path: "script.js",
        content:
          'document.getElementById("btn").addEventListener("click", function () {\n  document.getElementById("msg").textContent = "Halo! Tombol berfungsi 🎉 (" + new Date().toLocaleTimeString("id-ID") + ")";\n});\n',
      },
      {
        path: "README.md",
        content:
          "# Landing Page\n\nWebsite statis sederhana.\n\nBuka `index.html` di browser, atau deploy folder ini ke Netlify / Vercel / GitHub Pages.\n\nDibuat dengan Zip2Repo ⚡\n",
      },
    ],
  },
  {
    id: "node-cli",
    icon: "⌨️",
    name: "Node CLI Tool",
    desc: "Template command-line tool Node.js dengan argumen sederhana.",
    tags: ["tools", "javascript"],
    files: [
      {
        path: "package.json",
        content:
          '{\n  "name": "my-cli",\n  "version": "1.0.0",\n  "type": "module",\n  "bin": {\n    "my-cli": "./bin/cli.js"\n  },\n  "scripts": {\n    "start": "node bin/cli.js"\n  }\n}\n',
      },
      {
        path: "bin/cli.js",
        content:
          '#!/usr/bin/env node\n\nconst args = process.argv.slice(2);\n\nif (args.includes("--help") || args.includes("-h")) {\n  console.log("Penggunaan: my-cli [nama]");\n  console.log("Contoh: my-cli Rifky");\n  process.exit(0);\n}\n\nconst nama = args[0] || "Dunia";\nconsole.log("Halo, " + nama + "! 👋 Dibuat dengan Zip2Repo.");\n',
      },
      {
        path: ".gitignore",
        content: "node_modules\n.DS_Store\n",
      },
      {
        path: "README.md",
        content:
          "# My CLI\n\nCommand-line tool sederhana.\n\n## Jalankan\n\n```bash\nnode bin/cli.js Rifky\n```\n\nDibuat dengan Zip2Repo ⚡\n",
      },
    ],
  },
  {
    id: "blank-docs",
    icon: "📝",
    name: "Blank + Docs",
    desc: "Repo kosong rapi: README, LICENSE MIT, CONTRIBUTING, dan .gitignore.",
    tags: ["docs"],
    files: [
      {
        path: "README.md",
        content:
          "# Proyek Baru\n\nDeskripsikan proyekmu di sini.\n\n## Fitur\n\n- [ ] Tulis fitur pertama\n- [ ] Tulis fitur kedua\n\n## Instalasi\n\n```bash\n# langkah instalasi...\n```\n\n## Lisensi\n\nMIT — lihat [LICENSE](LICENSE).\n\nDibuat dengan Zip2Repo ⚡\n",
      },
      {
        path: "LICENSE",
        content:
          "MIT License\n\nCopyright (c) 2026\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n",
      },
      {
        path: "CONTRIBUTING.md",
        content:
          "# Panduan Kontribusi\n\nTerima kasih sudah mau berkontribusi! 🎉\n\n1. Fork repository ini.\n2. Buat branch baru: `git checkout -b fitur-keren`.\n3. Commit perubahanmu.\n4. Push dan buka Pull Request.\n",
      },
      {
        path: ".gitignore",
        content: "node_modules/\ndist/\n.env\n__pycache__/\n.DS_Store\n",
      },
    ],
  },
];
