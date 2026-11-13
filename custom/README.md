# Özel IPTV Listeleri

Bu klasör, [generate.mjs](./generate.mjs) betiği tarafından `streams/*.m3u` dosyaları ve `iptv-org` kanal/dil/kategori API verileri birleştirilerek oluşturulur.

## Uygulanan Filtreler

- **İngilizce (`eng`):** `movies`, `series`, `sports`
- **Fransızca (`fra`):** `movies`, `series`, `sports`, `news`, `documentary`
- **Hariç tutulanlar:** Türk kanalları (`TR` / `tur`), NSFW ve telif bloklistesi kanalları
- Her kanal için tek en iyi akış seçilir (öncelik sırası: coğrafi engelsiz > `https://` > 24/7 > ana yayın > yüksek çözünürlük).

## VLC'de Kullanım

**Ortam → Ağ Akışı Aç** (`Ctrl+N`) menüsünden doğrudan yapıştırabilirsiniz:

- **Tüm eşleşen kanallar (625 kanal):**
  `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/playlist.m3u`
- **Sadece şifreli `https://` yayınlar (542 kanal — daha güvenli):**
  `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/playlist-https.m3u`

## Listeyi Yenileme

Yerelde çalıştırmak için (Node.js 20+ yeterlidir):

```bash
node custom/generate.mjs
```

Filtreleri değiştirmek için [generate.mjs](./generate.mjs) dosyasındaki `CONFIG` bölümünü düzenleyip betiği tekrar çalıştırabilirsiniz.
