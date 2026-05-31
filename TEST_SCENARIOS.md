# Test Durumları — Adım Adım Rehber

Bu doküman, ACO Thermal Printer Service projesini manuel olarak nasıl test edeceğinizi adım adım anlatır.

## Hazırlık

```powershell
cd c:\Users\fonur\Desktop\aco-rec-task
npm start
```

Tarayıcıda aç: **http://localhost:3000**

Dashboard her **2 saniyede** kendini yeniler; bir aksiyondan sonra sonucu görmek için 2–3 saniye bekleyin.

| Adım | Ne yap | Beklenen |
|------|--------|----------|
| 0.1 | `npm start` çalıştır | Terminalde `listening on http://localhost:3000` |
| 0.2 | http://localhost:3000 aç | Dashboard görünsün |
| 0.3 | Sağ üst göstergeye bak | `NONE · disconnected` (kırmızı/gri nokta) |

---

## TEST 1 — USB Bağlantısı (CORE)

**Amaç:** Bağlantı modu seçimi + UI göstergesi

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect USB** butonuna bas | ~1 sn sonra sağ üst: `USB · connected` (yeşil nokta) |
| 2 | Connection kartına bak | Paper: ok, Cover: closed, Temperature: normal |
| 3 | Live Logs'a bak | `"op":"connect"`, `"status":"ok"`, `"conn":"usb"` satırı |

---

## TEST 2 — LAN Bağlantısı (CORE)

**Amaç:** İkinci bağlantı modu

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect LAN** butonuna bas | Sağ üst: `LAN · connected` |
| 2 | Live Logs | `"conn":"lan"` ile connect logu |

---

## TEST 3 — Basit Metin Baskısı TR (CORE)

**Amaç:** `POST /print/text` + Türkçe

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | Önce **Connect USB** | Bağlı olsun |
| 2 | Text alanına `Merhaba fiş testi` yaz | — |
| 3 | Language: **Türkçe** | — |
| 4 | **Print Text** butonuna bas | Queue'da yeni satır: `queued` → `processing` → `completed` |
| 5 | Live Logs | `"op":"print_text"`, `"status":"ok"` |
| 6 | Queue summary | Completed +1 |

---

## TEST 4 — Basit Metin Baskısı EN (CORE)

**Amaç:** İngilizce baskı

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | Language: **English** seç | — |
| 2 | Text: `Hello receipt test` | — |
| 3 | **Print Text** | Job `completed`, logda `print_text` + ok |

---

## TEST 5 — Yapılandırılmış Fiş (Voucher benzeri) (CORE)

**Amaç:** Receipt payload + QR alanı

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect USB** | Bağlı |
| 2 | **Print Sample Receipt** butonuna bas | Queue'da `type: receipt` job |
| 3 | ~2 sn bekle | Status `completed` (nadiren `failed` — rastgele hata olabilir) |
| 4 | Live Logs | `print_text` + ok |

**Alternatif (PowerShell):**

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/print/text -ContentType application/json -Body (Get-Content samples/receipt-payload.json -Raw)
```

---

## TEST 6 — Voucher Görsel Baskısı (CORE)

**Amaç:** `POST /print/image` + base64

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect USB** | Bağlı |
| 2 | **Print Voucher Image** butonuna bas | Queue'da `type: image` job |
| 3 | Bekle | `completed` veya `failed` |
| 4 | Live Logs | `"op":"print_image"` satırı |

---

## TEST 7 — Kağıt Sıkışması + Hata Banner (CORE)

**Amaç:** Hata UI'da görünsün + loglansın

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect USB** | Bağlı |
| 2 | **Simulate Paper Jam** (kırmızı buton) | Üstte kırmızı banner: **Kağıt sıkışması** |
| 3 | **Print Voucher Image** veya **Print Text** | Job `failed`, Error: `PAPER_JAM` |
| 4 | Live Logs | `"status":"error"`, `"code":"PAPER_JAM"` |
| 5 | Banner'daki **×** ile kapat | Banner kaybolur (**hata devam eder**, sadece gizlenir) |

> **Önemli:** **×** sadece banner'ı kapatır. Yazıcıdaki hata **Clear Error** ile temizlenir. Reprint öncesi mutlaka **Clear Error** bas.

---

## TEST 8 — Başarısız Görsel Saklama + Tekrar Bastır (CORE)

**Amaç:** Failed job store + reprint

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect USB** | — |
| 2 | **Simulate Paper Jam** | Hata aktif |
| 3 | **Print Voucher Image** | Job `failed` |
| 4 | **Failed Jobs** bölümüne bak | Thumbnail + jobId + **Tekrar Bastır** butonu |
| 5 | **Clear Error** butonuna bas | Hardware normale döner |
| 6 | Failed Jobs'ta **Tekrar Bastır** | Yeni job kuyruğa girer, logda `"op":"reprint"` |
| 7 | Bekle | Reprint job `completed` olabilir |

Queue tablosunda failed satırın yanındaki **Tekrar Bastır** butonu da aynı işi yapar.

---

## TEST 9 — Hata Temizleme (CORE)

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Simulate Paper Jam** | Banner + hata |
| 2 | **Clear Error** | Paper/Cover/Temp normale döner |
| 3 | **Print Text** | Bu sefer `completed` olma ihtimali yüksek |

---

## TEST 10 — Rastgele Donanım Hataları (CORE)

**Amaç:** `PAPER_OUT`, `PAPER_JAM`, `COVER_OPEN`, `OVERHEAT` rastgele tetiklenir (`.env` → `ERROR_PROBABILITY=0.12`)

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect USB** | — |
| 2 | **Print Text**'e 5–10 kez bas | Bazı job'lar `failed` |
| 3 | Failed job error sütununa bak | `PAPER_OUT`, `PAPER_JAM`, `COVER_OPEN`, `OVERHEAT` görülebilir |
| 4 | Banner mesajları | Kağıt bitti, Kapak açık, Aşırı ısınma vb. |

**Hızlı demo için:** `.env` içinde geçici olarak `ERROR_PROBABILITY=0.8` yapın, test bitince geri alın.

---

## TEST 11 — Otomatik Kopma + Yeniden Bağlanma (CORE)

**Amaç:** `COMM_ERROR` + exponential backoff

| # | Aksiyon | Beklenen sonuç |
|---|---------|----------------|
| 1 | **Connect USB** | Bağlı |
| 2 | 15–30 sn bekle | Gösterge `reconnecting` veya `error` olabilir |
| 3 | Live Logs | `"op":"disconnect"`, `"op":"reconnect"` satırları |
| 4 | Bekle | Tekrar `connected` olur |
| 5 | Kopma anında **Print Text** | Job bekler; bağlanınca basılır |

**Hızlandırmak için:** `.env` içinde `DISCONNECT_PROBABILITY=0.5`

---

## TEST 12 — Idempotency (Bonus)

**Amaç:** Aynı `jobId` ile iki istek → mükerrer basım yok

```powershell
$body = '{"jobId":"same-job-1","text":"Idempotency test","lang":"tr"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/print/text -ContentType application/json -Body $body
Invoke-RestMethod -Method Post -Uri http://localhost:3000/print/text -ContentType application/json -Body $body
```

| Beklenen | |
|----------|--|
| İlk istek | 202 + job queued |
| İkinci istek | 200 + `"duplicate": true` |
| Queue | Tek job, çift basım yok |

---

## TEST 13 — API Uçları (Postman / Tarayıcı) (CORE)

Postman collection: [`postman/aco-printer.postman_collection.json`](postman/aco-printer.postman_collection.json)

| Endpoint | Nasıl test | Beklenen |
|----------|------------|----------|
| `GET /health` | http://localhost:3000/health | `"status":"ok"`, uptime |
| `GET /status` | http://localhost:3000/status | connection, hardware, queue, failedJobs |
| `GET /logs` | http://localhost:3000/logs | JSON log dizisi |
| `GET /logs?format=csv` | Tarayıcıda aç | CSV formatında log |
| `POST /reprint` | `{ "jobId": "..." }` | 202 veya 404 |

---

## TEST 14 — Geçersiz İstek (UNKNOWN_COMMAND) (CORE)

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/connect -ContentType application/json -Body '{"mode":"wifi"}'
```

| Beklenen | |
|----------|--|
| HTTP 400 | |
| Body | `"code":"UNKNOWN_COMMAND"` |

---

## TEST 15 — Otomatik Testler

```powershell
npm test
```

8 test geçmeli: connect, idempotency, log şeması, csv, reprint, health, backoff.

---

## TEST 16 — Docker (Bonus)

```powershell
docker-compose up --build
```

http://localhost:3000 açılmalı; TEST 1–3 tekrarlanabilir.

---


## Teslim Öncesi Kontrol Listesi

- [x] USB bağlanıyor
- [x] LAN bağlanıyor
- [x] Metin basılıyor (TR + EN)
- [x] Receipt basılıyor
- [x] Voucher image basılıyor
- [x] Hata banner Türkçe çıkıyor
- [x] Failed image saklanıyor
- [x] Tekrar Bastır çalışıyor
- [x] Loglar doğru formatta (`ts`, `op`, `conn`, `jobId`, `status`, `error`)
- [x] `npm test` geçiyor
- [x] 1–2 screenshot alındı

---

## Sık Sorunlar

| Sorun | Çözüm |
|-------|--------|
| Sayfa açılmıyor | `npm start` çalışıyor mu? Port 3000 dolu mu? |
| Print hemen failed | Önce **Clear Error**; Paper Jam simülasyonu aktif olabilir |
| Voucher basmıyor | `samples/voucher.png` var mı? Yoksa: `node scripts/create-voucher.js` |
| API 401 Unauthorized | `.env`'de `API_TOKEN` var; isteklere `Authorization: Bearer optional-dev-token` ekleyin |
