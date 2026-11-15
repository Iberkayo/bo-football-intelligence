# BO-BET Geçmiş Test Verisi — V2 (10 lig, 15 Kasım 2026)

Geçmiş Tahminler sayfası artık `bo-history/v2` biçimindeki `data/history.json`
dosyasını okuyor.

## İçerik
- Kapsam: **1 Ağustos – 14 Kasım 2026** (Türkiye tarihi), **10 lig**, **1.084 maç**.
- Model: yalnız Ridge champion, `ridge_poisson`, ile aynı ayarlar. Canlı dondurma gibi her maç günü yeniden eğitilir (`replay_refit_days: 1`, E6 `ridge_daily` kolu).
- Sonuç: en olası görülen sonuç **572** maçta gerçekleşti (%52,8).
- Lig bazında doğru seçim oranı: Belçika %62, Serie A %61, Primeira %58, Ligue 1 %57, Süper Lig %55, La Liga %54, Premier %51, Eredivisie %49, Bundesliga %49, Championship %41.
- 15 Kasım güncellemesi: önceki sürüm modeli 14 günde bir yeniden eğitiyordu (568 doğru, %52,4). Canlı sistem her çalışmada yeniden eğittiği için replay ona eşitlendi. Model ve ayarları değişmedi.

## Yöntem
- Tarih bazlı replay: her gün, o günün hiçbir sonucu görülmeden tahmin edilir; eğitimde yalnız daha önceki günler kullanılır.
- Statü: `RETROSPECTIVE_REPLAY_NOT_PROSPECTIVE`. Bunlar maçtan önce yayınlanmış tahminler değildir.
- Canlı ve maç öncesi kayıtlar ayrı tutulur (`data/predictions.json`).
- E5 gölge modeli ve Opportunity C bu dosyada **yok**.

## Üretim (özel taraf, sıfır API isteği)
1. `bo-bet`: `python -m bobet.e6_ridge_fixes` ile `preregistration/e6_20261115_ridge_fixes_exploratory.json` planı çalıştırılır. Çıktı: özel `results\e6-ridge-fixes-20261115`.
2. `python -m bobet.site_history_export --arm ridge_daily` yalnız champion replay kolunu alır, skor ve kimlikleri Silver ile karşılaştırır, sonra staging klasörüne `history.json` yazar. Git checkout içine yazmayı reddeder.
3. Dosya bu repoya kopyalanır. `node tools/logic-test.js` sayıları doğrular.

`tools/import_history_csv.py`, V1 (2–8 Kasım, 63 maç, SHA'ya kilitli) içindir ve tarihsel kayıt olarak durur.
`assets/js/history.js` hem v1 hem v2 biçimini okuyabilir.

---

# BO-BET Geçmiş Test Verisi — V1

Bu sayfa, **2–8 Kasım 2026** döneminde altı ligden **63 tamamlanmış maça**
ait sabit, geçmişe dönük araştırma çıktılarını yayınlar.

## Kaynak ve statü
- Kaynak dosyası (yerel/özel): `week_2026-11-02_to_08_ridge_vs_opportunity_c.csv`
- Kaynak SHA-256: `f9e675ecf2cb66d675d8dc21d3d95177d54c51191052f875e4343d4c0aed140d`
- Veri statüsü: `RETROSPECTIVE_REPLAY_NOT_PROSPECTIVE`
- Yayın statüsü: `PAPER_ONLY_NO_BET`
- Ridge: **39 doğru, 24 yanlış**
- Opportunity C: **37 doğru, 26 yanlış**

CSV yalnızca deney/araştırma alanında tutulur. Bu web reposu yalnızca gerekli
maç kimliği, maç/zaman bilgisi, skor ve model tarafından hesaplanmış
olasılıkları içeren **türetilmiş** `data/history.json` dosyasını içerir. Ham
API-Football yanıtlarını, manifestleri, özel veri arşivlerini veya API
anahtarlarını bu repoya kopyalamayın. İleride kamusal yayının veri lisansına
uygunluğu ayrıca kontrol edilmelidir.

**Dikkat:** Bu tahminler maçtan önce gerçekten yayınlanmış tahminler değildir.
Sonradan çalıştırılmış, tarih sıralı replay çıktılarıdır. Sonuçlardan sonra
geriye dönük üretilen verinin başarı oranını canlı başarı olarak etiketlemeyin.

## Tekrar üretim (yerel, sıfır API isteği)

PowerShell'de web repo kökünden:

```powershell
python tools/import_history_csv.py "C:\BO-Football-Experiments\bo-opportunity-v1-week-20261102-08\week_2026-11-02_to_08_ridge_vs_opportunity_c.csv" --output data/history.json
node tools/logic-test.js
```

Importer yalnızca **bu onaylı haftalık CSV'yi**, beklenen SHA-256 ve
63/39/37 sayılarıyla doğruladıktan sonra dışa aktarır. Kaynak dosyayı
değiştirmez; model eğitimi, API çağrısı veya forecast-ledger işlemi yapmaz.
Farklı tarihleri otomatik içeri almak için bu sözleşmenin yeni bir sürümü
ve yeni veri kanıtları gerekir.

## Web önizlemesi

Tarayıcının `file://` güvenlik kuralları `fetch("data/history.json")`
isteğini engelleyebilir. Statik HTTP sunucusu kullanın:

```powershell
python -m http.server 8000
```

Ardından `http://localhost:8000/gecmis-tahminler.html` adresini açın.
`node tools/logic-test.js` ham JSON'u, model olasılıklarını, 63 kayıt
sayısını ve doğru/yanlış sonuçlarını kontrol eder. Web tarafı aynı şemayı
tekrar doğrular; geçersiz veri gösterilmez.

## Sonraki aşama (henüz otomatik değil)
- Yaklaşan gerçek maç fikstürlerini, doğrulanmış kaynak snapshot'larından
  **ayrı bir `fixtures.json`** akışıyla yayınlamak.
- Ancak gerçek maçtan önce kaydedilmiş ve zaman kanıtı bulunan
  append-only PAPER tahminleri `predictions.json` içinde yayınlamak.
- Bitmiş maçları yalnızca doğrulanmış sonuç geldiğinde değerlendirmek.
- Otomatik Github Actions yayınını tazelik/manifest kontrollerine bağlamak.

Bu V1, gerçek geçmiş veri entegrasyonudur; **günlük API yenilemesi henüz yoktur**.
