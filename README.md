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

- Yalnızca benzersiz kullanıcı adı ve parola ile hesap oluşturma, giriş ve çıkış. E-posta veya gerçek ad istenmez.
- Kullanıcı adı 3–24 karakterdir; harfle başlar; harf, rakam ve alt çizgi içerir. Yazım biçimi korunur, karşılaştırma büyük/küçük harfe duyarsızdır. Büyük/küçük harf farkıyla ikinci hesap açılamaz. Profilde değiştirilebilir; başka kullanıcıya ait ad alınamaz.
- Eski hesaplara ilk açılışta benzersiz `user_...` kullanıcı adı atanır; kullanıcı kimliği, e-posta, parola ve mevcut oturumlar korunur.
- Kullanıcı menüsü, kişisel karşılama alanı ve `@kullanıcıadı` profil başlığı. Profiller diğer kişilere açık bir kullanıcı dizini oluşturmaz.
- Diğer oturumları kapatma, mevcut oturumu ve başka kullanıcıların oturumlarını etkilemez.
- Yalnızca kullanıcı adı, animasyon tercihi ve profil rengi düzenleme. Gerçek ad, kurum ve biyografi alanları yoktur.
- Mevcut parolayla parola değiştirme; değişiklik diğer oturumları iptal eder.
- Tuzlanmış `scrypt` parola özeti; rastgele oturum anahtarının SHA-256 özeti sunucuda tutulur.
- 7 günlük HttpOnly, SameSite=Lax oturum çerezi. Production/HTTPS altında Secure kullanılır.
- Durum değiştiren API isteklerinde JSON içerik türü ve kaynak kontrolü; hesap işlemlerinde kısa süreli IP tabanlı deneme sınırı.

E-posta toplanmaz. Kullanıcı API yanıtları ad, e-posta, kurum veya biyografi içermez. Eski veritabanı sütunları uyumluluk için tutulur; yeni hesaplar için gerçek e-posta yerine dahili yer tutucu kullanılır. Unutulan parola kurtarma bu sürümde yoktur. Arayüz bunlar için çalışmayan bağlantılar sunmaz. Misafirler ölçümleri kullanabilir. Profil ve hesap bilgileri paylaşılmadan önce uygun veri saklama/yedekleme düzeni kurulmalıdır.

## Otomatik iki sıvı karşılaştırması

Ölçüm alanı tek akıştan oluşur; kütle/hacim ve harici sensör giriş formları kaldırılmıştır. İki alan 64 × 64 piksele örneklenir. Kameradan sekiz kare, fotoğraftan tek kare alınır. Seri ortancaları, karanlık/parlama ve kareler arası değişim kontrolüyle birlikte kullanılır.

Kanal ortalamalarına yaklaşık sRGB doğrusallaştırması uygulanır. Normalize renk oranlarının Öklid uzaklığı ve göreli ışık farkı `−log10(Y_sample/Y_reference)` birlikte değerlendirilir. Bu kamera göstergesi kalibre edilmiş absorbans veya mutlak optik yoğunluk değildir. Telefonun işlenmiş pikselleri, sensör yanıtı ve otomatik ayarları fiziksel ışık ölçümü yerine geçmez. Işık uçuş süresi, kütle yoğunluğu, kimyasal kimlik ve saflık ölçülmez.

Karar eşiği: renk farkı > 0.075 veya mutlak göreli ışık farkı > 0.12 ise belirgin fark; her ikisi sırasıyla < 0.025 ve < 0.035 ise benzer görünüm. Ara bölge belirsiz bırakılır. Bu pratik eşikler gerçek numunelerde doğrulanmamıştır; doğruluk oranı veya kimyasal kimlik iddiası yoktur. Kalite sorunu veya tek fotoğraf varsa sonuç yetersizdir. Rapor gündelik dille açıklanır, teknik göstergeler ayrıntı alanında tutulur; indirilen JSON da karar ve sınırlarını içerir.

Alan önerisi renkli homojen dikdörtgenler arar; sıvı tanıma modeli değildir. Kutular kullanıcı tarafından kontrol edilmelidir. Aynı kap, eşit sıvı seviyesi, arkadan eşit aydınlatma ve yer değiştirerek tekrar çekim önerilir. Demo sonuçları açıkça sentetik olarak işaretlenir.

## Çekim asistanı

Canlı kamerada cihaz yetenekleri sorgulanır. Desteklenen sürekli pozlama, odak ve beyaz dengesi modları istenir. Karanlık/aşırı aydınlık alanlarda pozlama telafisi cihazın sınırları ve adımları içinde kademeli değiştirilir. Bir taraf çok karanlıkken diğeri çok parlaksa veya karanlıkla kırpılma birlikteyse düzeltme yapılmaz; aydınlatma düzeni önerilir. Her istek sonrası kamera ayarı geri okunur; doğrulanamayan ayar başarılı sayılmaz.

Otomatik fener ayrıca onaylanır ve varsayılan kapalıdır. Parlamada açık fener kapatılabilir. Elle EV ayarı otomatik desteği kapatır. Başlangıç ayarlarını sıfırlama ve tek dokunuşla düzeltme düğmeleri bulunur. Ayar sırasında ölçüm başlatılamaz; değişiklikten sonra 650 ms beklenir. Sekiz karelik ölçüm sırasında uygulama kamera ayarını değiştirmez. Cihazın kendi otomatik modları çalışabilir; seri kontrolü değişimleri yakalar. Otomatik destek renk veya parlaklık filtreleriyle görüntüyü değiştirmez. Fotoğraf/demo modunda cihaz kontrolleri kapalıdır.

İndirilen rapor yalnızca gerekli çekim ayarlarını ve son 20 düzenleme isteğinin doğrulanma durumunu içerir; donanım kimliği dışa aktarılmaz. Tarayıcı testleri destekli ve desteksiz kamera akışını, elle EV, sıfırlama ve mobil paneli kontrol eder; gerçek telefon kamera sürücüsü/fener davranışı ayrıca denenmelidir. API referansı: [W3C Image Capture](https://www.w3.org/TR/image-capture/).

## Yer değiştirerek tekrar kontrolü

Uygun bir canlı çekimden sonra iki kabın fiziksel yeri değiştirilir; arayüz referans/numune kutularını birlikte taşır. Kullanıcı kutuların aynı sıvıları izlediğini onaylamadan ikinci ölçüm başlatılamaz. İlk ve ikinci ölçümün yönlü ışık/renk farkları karşılaştırılır. Aynı kaplar, eşit sıvı yüksekliği ve aynı numuneler varsayılır; kap değiştirme algılanmaz. Yanlış etiketleme, kamera işlemesi veya kap etkisi bu kontrolü yanıltabilir. Demo akışı ayrıca işaretlenir; gerçek doğrulama değildir.

Renk farkı vektörleri arasındaki uzaklık > 0.05 veya göreli ışık farklarının yarı farkı > 0.06 ise çekim düzeninin etkisi raporlanır. İki çekimde de benzer veya farklı görünüm varsa tutarlılık belirtilir; diğer durumlar belirsiz kalır. Bunlar doğrulanmamış pratik eşiklerdir. Aynı madde/saflık kararı üretilmez. Yetersiz ikinci çekimde ilk çekim korunur, ikinci çekim yeniden denenebilir. İptal veya kaynak değişikliği bekleyen kontrolü temizler. Sonuçlar yalnızca açık sayfanın belleğinde tutulur; arşiv veya hesap kaydı oluşmaz. İndirilen rapor ilk çekimin sayısal özetini ve tekrar sonucunu ayrı alanlarda içerir.

Seçili bölgelerin yakın görünümleri doğrudan işlenmemiş kırpma alanlarından gösterilir. Canlı panelde ışık, kanal kırpılması ve son dört ön kontrolün kararlılığı ayrı görünür. Ön kontrol, tam sekiz karelik son ölçümün yerini almaz. Görüntü değişimi hareket, ışık veya kameranın otomatik ayarlarından kaynaklanabilir; fiziksel hareket algılayıcı iddiası yoktur.

## İsteğe bağlı yapay zekâ yorumu

Google Gemini 2.5 Flash-Lite, sayısal kamera özetini günlük Türkçeyle açıklayıp en fazla üç tekrar çekim önerisi sunar. Yapay zekâ görüntüden sıvı tanımaz ve uygulamanın benzer/farklı/belirsiz kararını değiştirmez. Model yorumları hata içerebilir. Yerel karşılaştırma API anahtarı veya yapay zekâ servisi olmadan çalışır.

Etkinleştirme:
1. [Google AI Studio](https://aistudio.google.com/apikey) üzerinden ücretsiz katmanda bir Gemini API anahtarı oluşturun. Anahtarı Git'e veya sohbete yazmayın.
2. Render → Environment bölümünde `GEMINI_API_KEY` değişkenine anahtarı ekleyip yeniden dağıtın.
3. Varsayılan model `gemini-2.5-flash-lite`; istenirse `GEMINI_MODEL` ile değiştirilebilir.

[Google fiyatlandırması](https://ai.google.dev/gemini-api/docs/pricing) bu model için ücretsiz giriş/çıkış kotası gösterir. Kota, bölgesel erişim ve model kullanılabilirliği sağlayıcıya bağlıdır. Kod ücretsiz hesap oluşturmaz veya ücretsiz katmanı zorlayamaz; ücretli faturalandırma açılmış bir anahtarda ücret oluşabilir. Ücretsiz kullanımda gönderilen veriler Google ürünlerini geliştirmek için kullanılabilir. Bu nedenle kullanıcı, sayısal özeti göndermeden önce açıkça onaylar. Fotoğraf, kullanıcı adı, notlar, hesap bilgileri ve cihaz kimlikleri gönderilmez. Sunucu yalnızca izin verilen sayısal alanları yeniden kurar; serbest kullanıcı metni modele aktarılmaz.

`GET /api/ai/status` yalnızca etkinlik ve model bilgisini verir. `POST /api/ai/interpret`, 8 KB sınırı, kaynak kontrolü, sayısal doğrulama ve kullanıcı onayı gerektirir. API anahtarı yalnızca sunucuda tutulur. Varsayılan günlük üst sınır tüm servis için 100 istektir (`AI_DAILY_LIMIT`); soket IP başına dakikada 5 istek, eşzamanlı en fazla 2 çağrı vardır. Vekil sunucu arkasındaki kullanıcılar IP sınırını paylaşabilir. Sınırlar bellektedir; yeniden başlatmada sıfırlanır, birden fazla sunucu örneğinde ortak değildir. Sağlayıcı kotası ayrıca geçerlidir. 20 saniyede zaman aşımı, eksik/engellenmiş model yanıtında açık hata, normal ölçüme devam etme davranışı bulunur.

Model yanıtları HTML olarak çalıştırılmaz. Yeni ölçüm/eski sonucu kapatma, bekleyen yapay zekâ isteğini iptal eder; sağlayıcı zaten aldıysa kota tüketimi geri alınamaz. Sonuç indirildiğinde varsa yapay zekâ yorumu ayrı `aiInterpretation` alanındadır.

Yapay zekâ sunucu testleri `npm test` kapsamındadır. `node test/ai-browser.mjs`, mevcut tarayıcı testiyle aynı `PLAYWRIGHT_MODULE` ve `BROWSER_EXECUTABLE` ayarlarını kullanır; onay, veri azaltma, kota hatası, yeniden deneme ve mobil görünümü sahte servisle sınar. Gerçek Gemini yanıtı, geçerli API anahtarı olmadan test edilemez.

## Veri ve testler

Görüntüler cihazda işlenir ve sunucuya gönderilmez. Ölçüm arşivi yoktur; kullanıcı isterse o anki görsel sonucu JSON olarak indirebilir veya yazdırabilir. Hesap bilgileri SQLite'ta saklanır. `.data/` ve SQLite dosyaları Git tarafından yok sayılır.

`npm test`: piksel hesapları, alan önerisi, seri kararlılığı, göreli ışık ve renk kararı, HTTP sunucusu ve hesap API'si testleri. Hesap testleri geçici bir dosyada gerçek oturum açma, profil ayrımı, parola değişikliği ve yeniden açılan veritabanıyla kalıcılığı sınar.

Tarayıcı testi için kurulu `playwright-core/index.mjs` yolunu `PLAYWRIGHT_MODULE`, Chromium tabanlı tarayıcı yolunu `BROWSER_EXECUTABLE` ile belirtip `node test/site-smoke.mjs` çalıştırın. Test ana sayfa, mobil menü, kamera/fotoğraf, otomatik karşılaştırma ve gerçek kayıt/giriş/profil akışını kontrol eder. Ekran görüntüleri `test-results/` klasörüne yazılır. Fiziksel telefonda kamera/fener ve gerçek sensör deneyleri ayrıca doğrulanmalıdır.
