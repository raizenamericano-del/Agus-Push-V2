# 🗜️ Zip2Repo v2.1 — ZIP → GitHub Repo Otomatis + Repo Manager

Web app modern untuk mengubah file **.zip** menjadi **repository GitHub** secara otomatis —
**plus dashboard repo manager lengkap**: kelola, update, hapus, edit, unduh, dan deploy semua repomu dari satu tempat. ⚡

![Logo](public/logo.png)

## ✨ Fitur

### 🚀 Upload & Push
- 🔑 **Token Gate** — GitHub Personal Access Token divalidasi ke API GitHub, disimpan hanya di `localStorage`.
- 👤 Menampilkan **username + avatar GitHub** setelah token valid.
- 📦 Form upload: nama repo bebas, **Private / Public**, drag & drop ZIP (maks. **100MB**, 1000 file, 100MB per file).
- 🗜️ ZIP **diekstrak di browser** (JSZip) — ringan untuk server.
- 🚀 Push via **Git Data API** (blob → tree → commit → ref) dengan progress per-file + terminal log real-time.
- 🔄 **Update repo lama dari ZIP** — mode 🧩 **Gabung** (file lama aman) atau 💥 **Timpa total**, branch bebas.
- 💬 **Commit message custom** + default yang bisa diatur di Settings.
- 📄 **README.md otomatis** jika tidak ada di ZIP (bisa dimatikan).
- 🎉 Sukses: **confetti + roket meluncur**, link repo, tombol **Deploy to Vercel**.

### 📚 Dashboard Repo Saya (BARU!)
- 📋 Daftar semua repo (s/d ±500) dengan **search, filter** (public/private/fork/archived), **sort** (update/push/bintang/nama).
- 📊 Statistik: total repo, stars, forks, private + **komposisi bahasa**.
- 📂 **Detail repo drawer**: tab Ringkasan (stats, bahasa, README preview, aksi cepat), File, Commit, Branch.
- 🌲 **File explorer**: jelajah folder, **preview kode + syntax highlight**, preview markdown & gambar, **upload file**, **hapus file**, unduh file.
- 🕘 **Riwayat commit** 30 terakhir + **manajemen branch** (buat, hapus, jadikan default).
- ✏️ **Edit repo**: rename, deskripsi, homepage, public/private, topics, default branch.
- 🗑️ **Hapus repo**: satuan (ketik nama repo) + **hapus massal** (mode pilih banyak, ketik HAPUS).
- ⭐ Star/unstar, 📋 copy clone URL, ⬇️ **unduh repo sebagai ZIP**, deploy ke **Vercel / Netlify / Railway**.
- 📊 **Export CSV** daftar repo. ⌨️ Shortcut **Ctrl+K** untuk cari repo.

### 🎨 Galeri Template (BARU!)
Bikin repo tanpa ZIP dari starter siap jalan: **React + Vite**, **Express REST API**, **Python App**, **Landing Page HTML**, **Node CLI**, **Blank + Docs**.

### ⚙️ Pengaturan & Keamanan
- 🛡️ Scope token terdeteksi otomatis: `repo` (wajib) + `delete_repo` (untuk hapus) — badge status di Settings.
- 🎛️ Preferensi: visibilitas default, commit message default, toggle README otomatis & efek suara.
- 🗑️ Ganti / hapus token, hapus riwayat per-item atau semua.
- 🛡️ Error handling lengkap: token invalid (401), repo sudah ada (422), rate limit (403), scope kurang, ZIP corrupt/kosong, dll.
- 🔒 Token **tidak pernah** disimpan di server — hanya browser → GitHub via HTTPS.

### 💅 UI/UX
- 🌌 Dark modern: glassmorphism, aurora blobs, grid, bintang, cursor glow.
- 📑 Navigasi tab (Upload / Repo Saya / Template) + **bottom-nav di HP**.
- 💀 Skeleton loading, empty state, toast bertumpuk, drawer animasi, modal geser.
- 🖥️ Splash boot terminal, terminal build log ala CI/CD, 3D tilt card, marquee, maskot levitate.

## 🔑 Cara Membuat GitHub Token (scope baru!)

1. Buka <https://github.com/settings/tokens>
2. **Generate new token (classic)**
3. Beri nama bebas
4. Centang **`repo`** (Full control of private repositories) **+ `delete_repo`** (untuk fitur hapus 🗑️)
5. **Generate token** lalu salin

## 🧰 Tech Stack

| Layer    | Teknologi                                              |
|----------|--------------------------------------------------------|
| Frontend | React 18 + Vite                                        |
| Styling  | Tailwind CSS (custom keyframes & animasi)              |
| Backend  | Express (`server.js`) + API handlers (`/api`)          |
| Unzip    | JSZip (di browser)                                     |
| GitHub   | @octokit/rest (server) + REST & Git Data API (client)  |

## 🚀 Jalankan Lokal

```bash
npm install
npm run dev        # frontend saja (Vite :5173)
# atau full (frontend hasil build + API):
npm run build && npm start   # :3000
```

> Mode `npm run dev` butuh backend API (`/api/*`) agar validasi token & create-repo jalan.
> Untuk dev full-stack, jalankan `npm run build && npm start`, atau proxy `/api` ke server Express.

## ☁️ Deploy

Project ini siap deploy ke **Railway / Render / VPS** (Node server):

- Build: `npm run build` → Start: `npm start` (port dari `process.env.PORT`)
- Static host (Netlify/Vercel) juga bisa — pindahkan `/api/*.js` menjadi Functions sesuai platform.

## 📁 Struktur Proyek

```
aguspush/
├── api/
│   ├── validate-token.js   # POST /api/validate-token (+ deteksi scope)
│   └── create-repo.js      # POST /api/create-repo
├── public/                 # logo, hero, maskot, roket, manifest
├── src/
│   ├── components/         # Background, Logo, TokenGate, Uploader, Stepper,
│   │                       # Dashboard, RepoCard, RepoDetail, FileViewer,
│   │                       # EditRepoModal, DeleteRepoModal, TemplateGallery,
│   │                       # SettingsPanel, Confetti, Toast, Modal, Markdown,
│   │                       # TerminalLog, SplashScreen, CursorGlow, TiltCard, ...
│   ├── lib/
│   │   ├── github.js       # extract ZIP, push, + full repo management API
│   │   ├── templates.js    # starter templates
│   │   ├── format.js       # fmt waktu/ukuran/bahasa/CSV
│   │   ├── storage.js      # token, user, settings
│   │   ├── history.js      # riwayat upload
│   │   └── sfx.js          # sound effects Web Audio
│   ├── App.jsx             # tab Upload / Repo Saya / Template
│   ├── main.jsx
│   └── index.css
├── server.js
├── tailwind.config.js
└── vite.config.js
```

---

Crafted with ⚡ by **RifkyDev**
