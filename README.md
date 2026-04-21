# Watchtower

Figma workspace'indeki tüm dosyaların RAM baskısını izleyen dashboard.

Figma editörü 2 GB RAM limitine sahip — büyük dosyalar bu limite yaklaştığında performans sorunlarına yol açar. Watchtower, hangi dosyaların tehlike bölgesinde olduğunu görsel olarak gösterir.

## Nasıl Çalışır

**Hızlı tarama** — Her dosya için `depth=2&geometry=omit` parametresiyle Figma API'sine istek atılır; sayfa, frame ve component sayısından göreli bir karmaşıklık skoru hesaplanır. Acordion açılınca otomatik tetiklenir (lazy loading).

**Derin tarama** — Dosyanın tam JSON'ı indirilir, byte boyutu ölçülür. `JSON boyutu × 7 ≈ tahmini RAM` formülüyle 2 GB limitine oranı hesaplanır. İstek üzerine çalışır.

**Renk kodlaması:**
- Yeşil — < %40 (< ~820 MB)
- Sarı — %40–70 (~820 MB – 1.4 GB)
- Kırmızı — > %70 (> ~1.4 GB, tehlike bölgesi)

**Cache** — Proje ve dosya listesi 30 dakika localStorage'da tutulur; her session'da sıfırdan çekilmez.

## Kurulum

### 1. Figma OAuth Uygulaması Oluştur

[figma.com/developers/apps](https://www.figma.com/developers/apps) adresinden yeni bir uygulama oluştur.

- **Callback URL:** `http://localhost:5173/oauth/callback`
- **Gerekli scope'lar:**
  - `current_user:read`
  - `file_content:read`
  - `file_metadata:read`
  - `projects:read`

### 2. Team ID'leri Bul

Figma'da bir team sayfasına git: `figma.com/files/team/TEAM_ID/...` — URL'deki sayısal ID'yi kopyala.

### 3. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
# Figma OAuth uygulamasından
VITE_FIGMA_CLIENT_ID=your_client_id
FIGMA_CLIENT_SECRET=your_client_secret

# OAuth callback adresi
VITE_FIGMA_REDIRECT_URI=http://localhost:5173/oauth/callback

# İzlenecek team'lerin ID'leri (virgülle ayrılmış)
VITE_FIGMA_TEAM_IDS=123456789,987654321

# Express sunucusu portu
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 4. Başlat

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

## Proje Yapısı

```
src/
├── App.tsx                  # Ana uygulama, state yönetimi
├── components/
│   ├── TokenForm.tsx        # OAuth giriş ekranı
│   ├── OAuthCallback.tsx    # OAuth callback işleyicisi
│   ├── FileAccordion.tsx    # Proje accordion bileşeni
│   ├── BranchRow.tsx        # Dosya satırı
│   ├── RamBar.tsx           # RAM göstergesi
│   ├── RiskSummary.tsx      # Risk özeti kartları
│   └── SortControls.tsx     # Sıralama, filtreleme, arama
├── lib/
│   ├── figmaApi.ts          # Figma API istekleri
│   ├── metrics.ts           # RAM hesaplama fonksiyonları
│   └── cache.ts             # localStorage cache yönetimi
└── types/
    └── figma.ts             # TypeScript tipleri

server/
└── index.ts                 # OAuth token exchange (Express)
```

## Teknik Notlar

- OAuth token'ı (`figu_` prefix'li) `Authorization: Bearer` header'ıyla gönderilir — PAT'lerin kullandığı `X-Figma-Token`'dan farklıdır.
- `client_secret` yalnızca Express sunucusunda tutulur, frontend'e asla gönderilmez.
- Figma `/files/{key}/branches` endpoint'i plan kısıtlamaları nedeniyle kullanılmıyor; branch dosyaları projects API'sinden ayrı file entry'ler olarak listelenir.
- Eşzamanlı istek sayısı `pLimit` ile sınırlandırılmıştır (max 5 paralel).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Express (OAuth sunucusu)
