# BO Football Intelligence — dondurulmuş maç öncesi tahmin yayını v1

**Durum:** Kod hazır, gerçek kayıt yok. Yalnız `PAPER_ONLY_NO_BET`.
Bu özellik yeni model çalıştırmaz, tahmin üretmez veya veri toplamaz. Kullanıcının
özel BO-BET repo/SQLite ledger'ında önceden oluşturulan Ridge kayıtlarını
salt okunur açar; kaynak kanıtı olmayan kayıtların yayını engellenir.

## İki bağımsız yayın paketi
1. `data/fixtures.json`: doğrulanmış 21 günlük API-Football Silver maç programı.
2. `data/predictions.json`: yalnız `ridge_poisson_api_silver_v1` modeliyle
   6–168 saat önceden dondurulmuş, kaynak/manifest doğrulaması geçen PAPER kayıtlar.

En az bir kayıt gelene kadar JSON'da `NO_VERIFIED_FROZEN_FORECASTS` ve boş
liste vardır. Kullanıcı “Tahmin bekleniyor” görür.

## Kesin yayın kontrolleri
- Ledger SQLite `mode=ro`; `record_json` dosyasının `record_sha256` kanıtı
  Ridge'in aynı canonical JSON SHA-256 algoritmasıyla tekrar hesaplanır.
- `forecast_frozen_at_utc` ledger ile uyuşmalı ve maçtan **6–168 saat önce**
  olmalı. Aykırı horizon, eksik eğitim SHA veya yanlış model **reddedilir**.
- Özel manifest `snapshots_v2` içindeki fixture snapshot ID/SHA kontrol edilir.
  Kaydedilmiş raw kaynak dosyasının SHA-256 değeri yeniden hesaplanır;
  fixture kaynağının zamanı tahmin dondurmasından **önce** olmalıdır.
- Fikstürün kimliği ve kickoff zamanı değişmemiş olmalı; site taşınmış
  maçta eski tahmini bağlamaz.
- Sadece source-verified, 36 saatten yeni güncel fikstür paketiyle export.
  Eski tarihli Silver paketinin sırf son görüntülenme zamanı yeni diye
  güvenilir sayılması engellenir.
- Daha önce yayınlanmış bir maçın tahmini, farklı bir freeze horizon'u
  eklenmiş olsa bile sessizce üzerine yazılmaz. Tek maç için ilk yayın
  değiştirilemez kalır.
- Opportunity C ve bahis oranları yayımlanmaz. Arşivden retrospektif
  tahmini canlı kayıt diye dönüştürmeyin.

## Windows PowerShell (gerçek yerel dosya yollarına göre düzenleyin)

Önce **kaynak refresh ve özel paper freeze** tamamlanmış ve ön kontroller
geçmiş olmalı; aşağıdaki komut bunları **başlatmaz**.

```powershell
cd "C:\Users\iberkayo\Desktop\sites\bo-football-intelligence"
python tools/export_fixtures_sqlite.py `
  --silver "C:\BO-Football-Staging\api-football-20261114\canonical\api-football-silver.sqlite3" `
  --from-date 2026-11-14 --days 21 --output data/fixtures.json

python tools/export_paper_forecasts.py `
  --ledger "C:\BO-Football-Staging\api-football-20261114\forecast-ledger.sqlite3" `
  --manifest "C:\BO-Football-Staging\api-football-20261114\manifest.sqlite3" `
  --fixtures data/fixtures.json --output data/predictions.json

node tools/logic-test.js
node tools/fixture-feed-test.js
node tools/prediction-feed-test.js
python -m unittest discover -s tools -p "test_export_fixtures.py" -v
python -m unittest discover -s tools -p "test_export_paper_forecasts.py" -v
python -m http.server 8000
```

**Önemli:** Yol örnektir; ilgili dosyaların gerçekten var olduğu
doğrulanmalı. Eğer dondurulmuş ledger henüz yoksa komut başarısız olur;
bu durumda boş `data/predictions.json` korunur. Arşivdeki sonradan
üretilmiş replay asla forecast ledger yerine kullanılmaz.

### Yayın
İlk veri paketini inceleyin, kaynak saatleri ve veri lisansı koşullarını
teyit edin. `data/*.json` dosyalarını ancak o zaman public repo için
onaylayın. Ham Silver, manifest, raw snapshot, ledger ve API anahtarları
GitHub'a **yüklenmez**.

Bugünkü GitHub Actions CI yalnızca kod/dosya doğrulama testlerini çalıştırır.
Özel SQLite ve API anahtarı GitHub Actions runner'ına aktarılmamıştır.
Her gün tamamen otomatik yenileme bunun ötesinde, güvenli kalıcı
private data runner + verified freeze sistemine ihtiyaç duyar.

### Kaynak/PIT kapsamı
Çift SHA ve yerel manifest kontrolleri, kayıtların **yerel kaynak zinciri
ve freeze alanlarıyla tutarlı** olduğunu gösterir. Dışarıdan bağımsız
zaman damgası sağlamaz; üretim tarihinin tarihsel API kullanılabilirliği
veya dış doğrulama kanıtı değildir. Yayında PAPER araştırma etiketi kalır.
