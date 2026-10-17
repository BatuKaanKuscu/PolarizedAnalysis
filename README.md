# Liquid Lens 3.0

Genel sıvı karşılaştırma sitesi. Ana sayfa, ölçüm alanı, yöntem kılavuzu ve gerçek hesap/profil akışı içerir. Ürün türü seçimi, ölçüm arşivi ve tarayıcıda ölçüm saklama kaldırılmıştır. Önceki sürümün tarayıcı verileri otomatik silinmez; yeni sürüm onları okumaz.

## Çalıştırma

Node **22.13+** gerekir; Node 24 desteklenir. Harici çalışma zamanı bağımlılığı yoktur. `npm start` sunucuyu `PORT` (varsayılan 3000) üzerinden `0.0.0.0` adresinde açar. Kamera için HTTPS veya localhost gerekir. Uygulama artık yalnızca statik site olarak sunulamaz; hesap API'si için Node sunucusu gerekir.

## Render kurulumu ve hesap kalıcılığı

- Branch: `main`
- Root Directory: boş
- Build Command: `npm install --omit=dev`
- Start Command: `npm start`
- Production ortamı: `NODE_ENV=production`

Hesap veritabanı varsayılan olarak `.data/accounts.sqlite` dosyasında oluşturulur. **Render'ın varsayılan dosya sistemi geçicidir. Kalıcı disk olmadan hesaplar ve oturumlar yeniden yayınlama/yeniden başlatmada kaybolur.**

Kalıcı hesaplar için Render'da ücretli bir Web Service'e kalıcı disk bağlanmalıdır. Diskin mount path değeri `/var/data` ise `AUTH_DB_PATH=/var/data/accounts.sqlite` ortam değişkenini ayarlayın. Bu değişkeni disk bağlandıktan sonra kullanın. Disk oluşturulması veya plan değişikliği bu kod tarafından yapılmaz. Mevcut `.data/accounts.sqlite` otomatik taşınmaz; canlı kullanıcı verisi oluştuysa yeniden konumlandırmadan önce tutarlı veritabanı yedeği alın. [Render kalıcı disk belgeleri](https://render.com/docs/disks).

Bu SQLite kurulumu tek sunucu örneği içindir. Birden fazla sunucu örneği arasında kullanıcı eşitlemesi sağlamaz. Hesap bilgileri veritabanında saklanır; ölçüm görüntüleri ve sonuçları hesaplara yüklenmez.

## Giriş ve profil

- Benzersiz kullanıcı adı, e-posta ve parola ile hesap oluşturma. Kullanıcı adı veya e-postayla giriş ve çıkış.
- Kullanıcı adı 3–24 karakterdir; harfle başlar, a-z, rakam ve alt çizgi içerir. Büyük/küçük harf farkıyla ikinci hesap açılamaz. Profilde değiştirilebilir; başka kullanıcıya ait ad alınamaz.
- Eski hesaplara ilk açılışta benzersiz `user_...` kullanıcı adı atanır; kullanıcı kimliği, e-posta, parola ve mevcut oturumlar korunur.
- Kullanıcı menüsü, kişisel karşılama alanı ve `@kullanıcıadı` profil başlığı. Profiller diğer kişilere açık bir kullanıcı dizini oluşturmaz.
- Diğer oturumları kapatma, mevcut oturumu ve başka kullanıcıların oturumlarını etkilemez.
- Ad, kurum, biyografi, animasyon tercihi ve profil rengi düzenleme.
- Mevcut parolayla parola değiştirme; değişiklik diğer oturumları iptal eder.
- Tuzlanmış `scrypt` parola özeti; rastgele oturum anahtarının SHA-256 özeti sunucuda tutulur.
- 7 günlük HttpOnly, SameSite=Lax oturum çerezi. Production/HTTPS altında Secure kullanılır.
- Durum değiştiren API isteklerinde JSON içerik türü ve kaynak kontrolü; hesap işlemlerinde kısa süreli IP tabanlı deneme sınırı.

E-posta sahipliği doğrulaması, e-posta gönderimi ve unutulan parola kurtarma bu sürümde yoktur. Arayüz bunlar için çalışmayan bağlantılar sunmaz. Misafirler ölçümleri kullanabilir. Profil ve hesap bilgileri paylaşılmadan önce uygun veri saklama/yedekleme düzeni kurulmalıdır.

## Üç farklı ölçüm yolu

### Görsel karşılaştırma

İki alan görünür görüntüden kırpılıp 64 × 64 piksele örneklenir. Ortalama RGB uzaklığı, parlaklık farkı ve seri kararlılığı gösterilir. Kameradan 8 kare, fotoğraftan tek kare alınır. Kamera geri çağrısı desteklenmiyorsa 180 ms aralık kullanılır. Işık ve kararlılık eşikleri pratik çekim filtreleridir; laboratuvar doğrulaması değildir. Kamera işleme, pozlama, beyaz dengesi ve yansımalar sonucu etkiler.

Alan önerisi renkli, homojen dikdörtgenler arar; sıvı tanıma modeli değildir. Renkli arka planları da seçebilir. Kullanıcı alanları doğrulamalıdır. Beyaz kontrol bölgesi kullanılmaz.

### Optik yoğunluk / absorbans

Doğrusal yanıtlı harici ışık sensörünün referans (I₀), numune (I) ve karanlık (Id) okumaları girilir:

`T = (I - Id) / (I₀ - Id)` ve `A = -log10(T)`.

Kaynak, dalga boyu, kap/optik yol ve sensör ayarları eşleşmelidir. İşlenmiş kamera RGB değerleri bu forma girilmemelidir. Düzeltilmiş referans ve sinyal pozitif değilse hesaplama yapılmaz. T > 1 sonuçları kırpılmaz; deney koşulunu kontrol etme uyarısı verilir. A boyutsuz optik yoğunluktur; kütle yoğunluğu değildir. Konsantrasyon veya karışım oranı hesaplanmaz. [IUPAC Beer–Lambert yasası](https://goldbook.iupac.org/terms/view/B00626).

### Kütle yoğunluğu

Gerçek tartı ve hacim ölçümleri kullanılır: `ρ = (dolu kap kütlesi - boş kap kütlesi) / hacim`. Gram ve mL girdilerinden g/mL ile kg/m³ hesaplanır; ölçüm sıcaklığı belirtilir. Kamera kütle, hacim veya sıcaklık ölçmez. Ölçüm cihazlarının belirsizliği hesaplanmaz. [BIPM tanımı](https://jcgm.bipm.org/vim/en/1.5.html).

**Hiçbir yol tek başına saflığı doğrulamaz.** Arayüz saf/sahte sınıflandırması, saflık yüzdesi veya %100 doğruluk iddiası üretmez. Saflık için maddeye özgü doğrulanmış analitik yöntem gerekir.

## Veri ve testler

Görüntüler cihazda işlenir ve sunucuya gönderilmez. Ölçüm arşivi yoktur; kullanıcı isterse o anki görsel sonucu JSON olarak indirebilir veya yazdırabilir. Hesap bilgileri SQLite'ta saklanır. `.data/` ve SQLite dosyaları Git tarafından yok sayılır.

`npm test`: piksel hesapları, alan önerisi, seri kararlılığı, fiziksel formüller, HTTP sunucusu ve hesap API'si testleri. Hesap testleri geçici bir dosyada gerçek oturum açma, profil ayrımı, parola değişikliği ve yeniden açılan veritabanıyla kalıcılığı sınar.

Tarayıcı testi için kurulu `playwright-core/index.mjs` yolunu `PLAYWRIGHT_MODULE`, Chromium tabanlı tarayıcı yolunu `BROWSER_EXECUTABLE` ile belirtip `node test/site-smoke.mjs` çalıştırın. Test ana sayfa, mobil menü, kamera/fotoğraf, bilimsel formlar ve gerçek kayıt/giriş/profil akışını kontrol eder. Ekran görüntüleri `test-results/` klasörüne yazılır. Fiziksel telefonda kamera/fener ve gerçek sensör deneyleri ayrıca doğrulanmalıdır.
