# BO-BET — Ridge PAPER çoklu piyasa analiz paneli

Bu değişiklik **gerçek bookmaker fiyatlarını public GitHub Pages'e taşımaz.** Kullanıcının özel API-Football hesabından alınmış oranlar `C:\BO-Football-Data` içindeki özel SQLite kaynaklarında kalır.

## Nasıl çalışır?

- Doğrulanmış `bo-fixtures/v1` ve `bo-predictions/v1` sözleşmelerinden geçen, gerçekten kickoff öncesinde dondurulmuş `ridge_poisson_api_silver_v1` tahmini varsa, maç kartında açılabilir `Diğer piyasalar · Ridge PAPER` bölümü görünür.
- `expected_goals=[λ_home,λ_away]` ve modelin yayımlanmış `p=[P(1),P(X),P(2)]` değerleri kullanılır.
- **Toplam 1.5/2.5/3.5 Alt–Üst:** Bağımsız Poisson takım golleri varsayımıyla toplam `Pois(λ_home+λ_away)` üzerinden hesaplanır.
- **Karşılıklı gol Var/Yok:** `(1-exp(-λ_home))·(1-exp(-λ_away))`.
- **Çifte şans 1X/X2/12:** `P(1)+P(X)`, `P(X)+P(2)`, `P(1)+P(2)`. Bu üç olay birbirini dışlamaz ve üç olasılık toplanıp 100 yapmaz.
- Her seçenekte model olasılığı ve **teorik adil ondalık fiyat** `1/p` gösterilir. Bunlar bir bahis şirketinin teklif ettiği gerçek fiyat veya oyuncuya bahis önerisi değildir.
- Hiçbir doğrulanmış tahmin yoksa **panel hiç gösterilmez**. Mevcut site başlangıcında `data/fixtures.json` ve `data/predictions.json` boş bekleme sözleşmeleri olduğu için yeni kartlarda sahte tahmin bulunmaz.
- Bu panel ne kitapçı oranı ne de tarihsel başarı istatistiği üretir. Bookmaker fiyatlarıyla gerçek as-of karşılaştırma için özel, kaynak doğrulanmış market ledger'ın ayrı yetkili yayın sözleşmesi gerekir.

## Kontroller

```bash
node tools/prediction-feed-test.js
node tools/paper-markets-test.js
```

Private repo'da ayrıca `python -m bobet.odds_integrity_report --data-root C:\BO-Football-Data` ile gerçek veri bütünlüğü ve Ridge eşleşme hazırlığı kontrol edilir.

**Sonraki aşama:** doğrulanmış güncel fikstür + frozen Ridge feed üretilmesi, özel piyasa fiyatı görüntüleme izinleri ve lisans kontrolü. Bu olmadan gerçek bookmaker fiyatı, ROI, CLV ya da değer avantajı yayımlanmaz.
