# Özel IPTV Listeleri

Bu klasör, [generate.mjs](./generate.mjs) betiği tarafından `streams/*.m3u` dosyaları ve `iptv-org` kanal/dil/kategori API verileri birleştirilerek oluşturulur.

## Uygulanan Filtreler

- **İngilizce (`eng`):** `movies`, `series`, `sports`
- **Fransızca (`fra`):** `movies`, `series`, `sports`, `news`, `documentary`
- **Hariç tutulanlar:** Türk kanalları (`TR` / `tur`), NSFW ve telif bloklistesi kanalları

## VLC'de Listelere Ayrılmış Kullanım

Masaüstü **VLC**, tek bir `.m3u` dosyasındaki `group-title="..."` etiketinden otomatik klasör oluşturmaz; tek bir uzun liste gösterir. Listeleri ayrı ayrı görmek için aşağıdaki **sadece `https://`** listelerini kullanabilirsiniz:

### 1. Tek Linkten Klasörlü Ana Menü (VLC'de açılır alt listeler)
VLC → **Ortam → Ağ Akışı Aç** (`Ctrl+N`):
- `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/https/index.m3u`
*(Oynatma listesinde 6 ayrı başlık görünür; çift tıkladığınızda o listenin kanalları açılır.)*

Alternatif olarak bilgisayarınıza indirip çift tıklayabileceğiniz gerçek klasörlü VLC formatı:
- [https/playlist.xspf](./https/playlist.xspf)

### 2. Kategori Bazlı Ayrı HTTPS Bağlantıları
İstediğin kategoriyi doğrudan VLC'de ayrı açabilirsin:

- **İngilizce Spor:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/https/en-sports.m3u`
- **İngilizce Dizi & Film:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/https/en-movies-series.m3u`
- **Fransızca Spor:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/https/fr-sports.m3u`
- **Fransızca Dizi & Film:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/https/fr-movies-series.m3u`
- **Fransızca Haber:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/https/fr-news.m3u`
- **Fransızca Belgesel:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/https/fr-documentary.m3u`

### 3. Tek Parça Tüm Liste
- **Sadece HTTPS:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/playlist-https.m3u`
- **HTTPS + HTTP:** `https://raw.githubusercontent.com/yigittsahbaz/iptv/master/custom/playlist.m3u`
