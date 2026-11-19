# Vice Coast Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/motumona/gta6-cover-art-01/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/motumona/gta6-cover-art-01/reward.svg)](https://make.fun/c/gta6-cover-art-01)

Web app offline yang mengubah foto + caption jadi cover art gaya poster GTA 6:
tata letak multi-panel, huruf judul besar bergaya poster, dan colour grade
sunset/neon Vice City. Foto dibaca di mesin sendiri dan tidak pernah diunggah.

## Cara memakai

1. Jalankan server statis lokal:
   ```sh
   node serve.ts
   ```
2. Buka <http://localhost:8080> di desktop Chrome.
3. Klik **Tambah Foto** (atau seret foto ke area pratinjau), atau pakai salah satu
   foto contoh bawaan.
4. Pilih tata letak panel, atur crop/zoom tiap panel dengan slider atau seret
   langsung di pratinjau, tulis judul + subjudul, pilih colour grade.
5. Export PNG: **1080 × 1080**, **1080 × 1350**, atau **1920 × 1080** — atau
   **Export Semua** untuk ketiganya sekaligus.

## Yang ada di dalam app

- `app/index.html` — struktur editor dan semua kontrol.
- `app/styles.css` — tampilan editor (tema sunset neon gelap).
- `app/cover.js` — mesin render cover: 4 layout panel, 4 colour grade
  (gradient-map + grain film + vignette), lettering judul Anton dengan
  outline dan bayangan, subjudul script Pacifico.
- `app/editor.js` — wiring editor: upload multi-foto + drag & drop, foto
  contoh, crop/zoom/pan per panel, export PNG, dan scene `?shot=`.
- `app/samples/` — dua foto contoh (dibuat image model, bebas dipakai).
- `app/fonts/` — Anton dan Pacifico (SIL Open Font License, lihat `OFL.txt`).

## Scene `?shot=` (untuk screenshot)

- `?shot=cover&photo=boulevard&caption=SUNSET%20HEIST` — gambar cover
  full-frame (layout hero-trio, grade Vice Sunset).
- `?shot=editor&photo=pier&caption=BOULEVARD%20QUEEN` — editor dengan
  foto Pier termuat.

## Catatan originalitas

Semua karya, huruf, dan font adalah buatan sendiri atau berlisensi bebas
(OFL). Tidak ada logo, wordmark, artwork, atau font resmi game apa pun
di entri ini.
