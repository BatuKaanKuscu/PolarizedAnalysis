# Liquid Lens · Kiralite kütüphanesi

Kiralite ve stereokimya için Türkçe kaynak kütüphanesi. Ana sayfa, IUPAC/OpenStax bağlantılı rehber, PubChem madde araması ve kullanıcı adıyla hesap/profil akışı vardır. İki sıvı karşılaştırması kaldırılmıştır. Kamera ile gözlem/fotoğraf ve cihazda çalışan belge asistanı vardır. Optik çevirme, enantiyomerik fazlalık veya saflık ölçülmez.

## Çalıştırma

Node 22.13+ gerekir. Harici çalışma zamanı bağımlılığı yoktur. `npm start`, `PORT` üzerinden Node sunucusunu başlatır. Hesap API'si ve kütüphane sorguları için Node sunucusu kullanılmalıdır.

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
- Kullanıcı adı ve profil rengi düzenleme. Gerçek ad, kurum ve biyografi alanları yoktur.
- Mevcut parolayla parola değiştirme; değişiklik diğer oturumları iptal eder.
- Tuzlanmış `scrypt` parola özeti; rastgele oturum anahtarının SHA-256 özeti sunucuda tutulur.
- 7 günlük HttpOnly, SameSite=Lax oturum çerezi. Production/HTTPS altında Secure kullanılır.
- Durum değiştiren API isteklerinde JSON içerik türü ve kaynak kontrolü; hesap işlemlerinde kısa süreli IP tabanlı deneme sınırı.

E-posta toplanmaz. Kullanıcı API yanıtları ad, e-posta, kurum veya biyografi içermez. Eski veritabanı sütunları uyumluluk için tutulur; yeni hesaplar için gerçek e-posta yerine dahili yer tutucu kullanılır. Unutulan parola kurtarma bu sürümde yoktur. Arayüz bunlar için çalışmayan bağlantılar sunmaz. Misafirler kütüphaneyi kullanabilir. Profil ve hesap bilgileri paylaşılmadan önce uygun veri saklama/yedekleme düzeni kurulmalıdır.


## Kiralite kayıtları

`GET /api/chemistry/search?q=...`, madde adı veya CAS numarasını PubChem PUG-REST'e gönderir. API anahtarı gerekmez. Türkçe örnekler: L-alanin, D-alanin, laktik asit ve L-laktik asit. Sınırlı bir ad eşleme listesi vardır; diğer adlarda İngilizce yazım gerekebilir. Aynı adla birden fazla kayıt bulunursa ilk beşi ayrı gösterilir. Bazı yaygın karışım adları yerel açıklamayla ayrılır.

Kaynak başlığı, CID, molekül formülü, IUPAC adı, molekül ağırlığı, atom/bağ stereokimya sayımları, izomerik SMILES ve InChIKey alınır. PUG-REST'te IsomericSMILES istendiğinde yeni yanıtlardaki SMILES anahtarı da desteklenir. Eksik stereokimya alanları sıfır yapılmaz; null olarak tutulur ve arayüzde çizgiyle gösterilir.

Tanımlı/tanımsız merkezler numunenin ölçümü olarak sunulmaz. Atom stereo merkezi sayısı tek başına kiralite kararı değildir; mezo ve eksenel kiralite gibi durumlar vardır. Tanımsız konfigürasyon rasemik numune kanıtı sayılmaz. R/S adlandırmasından optik çevirme işareti türetilmez. Optik çevirme ve enantiyomerik fazlalık için veri olmadığı açıkça belirtilir; sahte ölçüm üretilmez.

Arama terimi dışında fotoğraf, hesap bilgisi veya kişisel not gönderilmez. Kullanıcı arama yapmadan kütüphane çağrısı yapılmaz. Başarılı yanıtlar en fazla 100 arama için 20 dakika bellekte tutulur. 10 saniye zaman aşımı, eşzamanlı iki istek ve soket IP başına dakikada 20 arama sınırı vardır. Vekil sunucu arkasında IP sınırı paylaşılabilir. Kaynak bağlantıları ve eksik veri açıkça gösterilir.

## Kaynaklar

- [PubChem PUG-REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest)
- [IUPAC: Chiral](https://goldbook.iupac.org/terms/view/C01057)
- [IUPAC: Enantiomer](https://goldbook.iupac.org/terms/view/E02069)
- [IUPAC: Racemate](https://goldbook.iupac.org/terms/view/R05025)
- [IUPAC: Optical activity](https://goldbook.iupac.org/terms/view/O04303)
- [OpenStax: R/S ve optik çevirme](https://openstax.org/books/organic-chemistry/pages/5-5-sequence-rules-for-specifying-configuration)

## Kamera ve fotoğraf

Kamera menüsünde izin yalnızca kullanıcı isteğiyle alınır. Çekim sırasında canlı görüntü açık kalır; son fotoğraf önizlenir. Fotoğraf yükleme, silme ve indirme bulunur. Kamera başka sayfaya geçildiğinde, hesap değiştiğinde veya sekme gizlendiğinde durdurulur. Fotoğraflar sunucuya yüklenmez ve kalıcı arşivlenmez. Küçük çekim çubuğu yalnızca kamera sayfasında ekranın altında sabittir. Kullanıcının girdiği adla kütüphane açılabilir; fotoğraftan kimlik/kiralite sınıflandırması yapılmaz.

## Belgelerden çalışan ücretsiz asistan

PDF, UTF-8 TXT/MD/CSV ve JSON dosyaları cihazda okunur. PDF.js 6.4.299 yerel paketlenmiştir; seçilebilir PDF metni sayfa numarasıyla çıkarılır. Şifreli ve taranmış/metinsiz PDF için açıklayıcı hata verilir; OCR yoktur. Sınırlar: 12 belge, dosya başına 8 MB/250.000 çıkarılmış karakter, PDF başına 80 sayfa, toplam 1.000.000 metin karakteri.

Belgeler IndexedDB'de bu tarayıcıda saklanır; sunucuya, PubChem'e veya uzak bir model servisine gönderilmez. Misafir ve kullanıcı kimlikleri arayüzde ayrı belge kapsamları kullanır. Bu depolama şifreli bir belge kasası değildir; ortak cihazda dosyaları silmek kullanıcıya aittir. Cihazlar ve farklı site adresleri arasında eşitleme veya sunucu yedeği yoktur. Tarayıcı verisi silinirse dosyalar yeniden yüklenmelidir. Depolama açılamazsa yalnızca açık oturumda geçici bellek kullanılır. Silme işlemi yerel dizini yeniler, kaynaklı yanıtı temizler ve yerel model worker'ını kapatarak eski belge bağlamını serbest bırakır.

Varsayılan kaynak taraması BM25 benzeri terim ağırlığı ve sınırlı Türkçe/İngilizce kavram eşlemesi kullanır. Metin bölümleri, dosya adı ve varsa PDF sayfasıyla alıntılanır. Kaynak yoksa yanıt uydurulmaz. Bu yöntem bir dil modeli değildir; belgeleri dizine ekler, model ağırlıklarını eğitmez.

İsteğe bağlı gerçek dil modeli: Qwen2.5-0.5B-Instruct-q4f16_1-MLC, WebLLM 0.2.86 aracılığıyla tarayıcı worker'ında WebGPU ile çalışır. Kütüphane ve lisansı uygulamada yereldir. Model ağırlıkları ve MLC WASM dosyaları ancak “Modeli indir ve aç” tıklanınca resmi model/artifact sunucularından indirilir. İlk kullanım yüzlerce MB indirme ve yaklaşık 1 GB GPU belleği isteyebilir. GPU/shader-f16 desteği kontrol edilir; uyumsuz cihazda belge taraması çalışmaya devam eder. API anahtarı veya ücretli model servisi gerekmez. İndirme/kapatma iptali ve yanıtı durdurma vardır.

Qwen, bu proje tarafından sıfırdan eğitilmemiş hazır açık kaynak modeldir. Yalnızca bulunan belge alıntıları soru bağlamına eklenir; ağırlıklar değiştirilmez. Küçük modelin Türkçesi ve çıkarımları hatalı olabilir. Kullanıcı her zaman asıl alıntıları görür. Belgelerdeki talimatlar veri olarak ayrılır; modelin dosya/sunucu işlemleri veya araç erişimi yoktur. Hesap değişiminde yerel model worker'ı kapatılır. Model önbelleği tarayıcı tarafından silinebilir.

Kaynaklar: [WebLLM](https://webllm.mlc.ai/docs/user/get_started.html), [Qwen MLC modeli](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC), [PDF.js](https://mozilla.github.io/pdf.js/). Lisanslar `dist/vendor/` altında yer alır.

## Kontroller

`npm test`: hesap, geçiş uyumluluğu, HTTP, kimya kütüphanesi, belge indeksleme ve metin okuma testleri. Tarayıcı kontrolleri `test/site-smoke.mjs`, `test/chemistry-browser.mjs`, `test/documents-browser.mjs`, `test/local-model-browser.mjs` dosyalarıyla çalıştırılır. Kurulu `playwright-core/index.mjs` yolunu `PLAYWRIGHT_MODULE`, tarayıcı yolunu `BROWSER_EXECUTABLE` ile belirtin. PDF/metin okuma, kaynaklar, kalıcılık, kullanıcı kapsamı, silme, canlı çekim, yerel model kitaplığının yüklenmesi ve GPU yokluğunda geri dönüş doğrulanır. Gerçek Qwen yanıt üretimi, yeterli WebGPU donanımında ayrıca denenmelidir; bu testte model ağırlıkları indirilmez.


Belge asistanı: Dosya seçerek bölüm bölüm Türkçe özet veya Türkçe/İngilizce/Almanca/Fransızca/İspanyolca çeviri oluşturulabilir. Çeviri ve modelin yorumladığı özetler için yerel model açılmalıdır. Model kapalıyken dosyanın farklı sayfalarından doğrudan alıntılar seçen hızlı özet kullanılabilir. Qwen2.5 1.5B önerilen, 0.5B hafif seçenektir; WebGPU gerekir. Tamamlanmamış işlem kısmi olarak etiketlenir; sonuç TXT olarak indirilebilir. Model çıktıları kontrol gerektirir. Belgeler model eğitimi için kullanılmaz.


İnternet terim araştırması: Belge asistanındaki işlem listesinden seçilir; dosya veya model gerektirmez. /api/research/search?q=terim, Vikipedi Türkçe giriş metinlerini arar; sonuç yoksa İngilizce dener. Üç kaynak, bağlantı, dil, erişim zamanı ve lisans gösterilir. Yerel model açıksa kaynak numaralı sade açıklama üretir. Yalnızca arama terimi dış kaynağa gider; belge içerikleri gönderilmez. Genel web/son dakika haber araması değildir. Sabit sağlayıcı, 10 saniyelik istek sınırı, 15 dakika önbellek, istemci başına dakikada 20 istek ve eşzamanlılık sınırı kullanılır.


Asistan kullanım kolaylıkları: Kısa/sade veya ayrıntılı/örnekli model açıklaması seçilebilir. Belge yanıtları, hızlı özetler ve internet araştırmaları kopyalanabilir; internet kaynaklarının bağlantıları ve lisans bilgileri TXT çıktısına eklenir. İlgili başlık düğmeleri yalnızca soru alanını doldurur, kendiliğinden internet isteği başlatmaz. Hızlı özet modeli indirmeden çalışır; özgün metin alıntıları sayfa numarasıyla gösterilir ve tam/yazılmış özet olduğu iddia edilmez.


Akıllı asistan varsayılan moddur: Belgelerde arar, uygun kaynak yoksa bu kullanıcıya ait taze araştırma belleğine bakar, sonra internet araştırması yapar. Kaynak bulunamazsa açık yerel model genel bir yanıt deneyebilir; doğrulanmadığı belirtilir. Genel soru/yazı/kod modu internet isteği yapmadan çalışır. Akıllı modda arama ifadesinin ilk 160 karakteri araştırma sağlayıcısına gider. Devam sorularında önceki yazdığın soru konu olarak kullanılabilir; belgeler ve önceki yanıtlar gönderilmez. Türkçe ve İngilizce arama, gerekirse kısaltılmış sorgu ile en fazla dört sağlayıcı isteği yapar. Araştırma belleği ayrı IndexedDB veritabanında, kullanıcıya göre saklanan en fazla 30 kaynak alıntısından oluşur; 7 günden eski kaynaklar yeniden kullanılmaz. Kaydetme kapatılabilir, bellek temizlenebilir. Bu bir model eğitimi, tüm internete erişim veya her soruya doğru yanıt garantisi değildir. Gerçek model çalışması GPU ve cihaz kaynaklarına bağlıdır.


Sohbet akışı: Son 8 başarılı soru/yanıt yalnızca açık sekmede tutulur. Devam soruları önceki konuya bağlanabilir; model istemine son iki konuşmadan toplam en fazla 800 karakter eklenir. Önceki yanıtlar kaynak sayılmaz ve arama servisine gönderilmez. Bağlam kapatılabilir; Yeni sohbet, hesap değişimi, belge değişiklikleri ve sayfa yenileme sohbeti temizler. Araştırma belleği ayrı kalır ve kendi temizleme düğmesiyle silinir. Başarısız veya iptal edilmiş yanıtlar sohbet geçmişine eklenmez. Mobilde sohbet bölümü dosyalardan önce gösterilir; model durumu ve indirme ayarlarına erişim sohbet panelinde görünür.


Sesli sohbet: Asistan panelindeki Sesli sohbeti başlat düğmesi Web Speech API tanımayı başlatır. Türkçe veya İngilizce konuşma yazıya çevrilir; yanıt dili Türkçedir. Sonuç alanına işlenir, otomatik gönderme açıksa mevcut soru akışına iletilir. Yerel model kapalıyken kaynak alıntıları seslendirilebilir. SpeechSynthesis yanıtı kısa parçalarla okur; cihazdaki Türkçe sesler ve okuma hızı seçilebilir. Karşılıklı konuşmada seslendirme boyunca mikrofon kapalı tutulur, ses bitince tekrar dinleme isteğe bağlıdır. Konuş / Söz al ile ses kesilip yeni soru sorulur. Sesi durdur, Sohbeti bitir ve otomatik gönderme/okuma kontrolleri vardır. Görünüm/hesap değişimi, arka plana geçiş, yeni sohbet ve sayfadan çıkış dinlemeyi ve seslendirmeyi durdurur. Ses kaydı uygulama sunucusuna yüklenmez ve uygulama tarafından saklanmaz; tarayıcının tanıma ve bazı sentez servisleri ses/metni çevrimiçi işleyebilir. HTTPS veya localhost gerekir. Tarayıcı desteği ve cihaz sesleri değişir; özellik desteklenmiyorsa yazılı asistan çalışır. Tanıma/sentez/model akışları tarayıcı testlerinde simüle edilmiştir; gerçek mikrofon ve servis kalitesi kullanıcı cihazında doğrulanmalıdır.

Ses API kaynakları: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition ve https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis .


Mikrofon izni: Sesli paneldeki Mikrofon izni ver düğmesi, ses tanıma desteğinden bağımsız olarak getUserMedia({audio:true,video:false}) çağırır. Erişim kontrolü için açılan akışın bütün izleri hemen durdurulur; ses tanımayla birlikte açık tutulmaz. Ana konuşma düğmesi de gerekiyorsa önce bu izin adımından geçer. Permissions API mevcutsa durum okunur ve izin değişiklikleri izlenir; mevcut değilse doğrudan erişim isteği yine çalışır. Önceden engellenmiş izin tarayıcıdan otomatik sıfırlanamaz; panel site/sistem izin adımlarını gösterir. İzin beklenirken sayfadan/hesaptan ayrılma veya yeni sohbet, geç tamamlanan isteğin ses tanımayı başlatmasını engeller ve dönen akış kapatılır. Tasarım büyük mikrofon düğmesi, ayrı izin/destek göstergeleri ve algılanan metin alanı içerir. Mikrofon testleri izin/hardware hatalarını simüle eder; ayrıca tarayıcının gerçek getUserMedia API’si sanal ses aygıtıyla doğrulanır.


Ses bağlantısı geliştirmeleri: Yazılı ve sesli giriş ayrı açılır; yazılı ekran varsayılandır. Ses tanıma API varlığı servis çalışıyor anlamına gelmez; panel API var, bağlanıyor, dinleme başladı, metin algılandı ve başarısız durumlarını ayırır. Başlangıç olayı gelmeyen tanıma 15 saniyede durdurulur. Standart hata kodları kopyalanabilir raporda gösterilir; rapor hesap, dosya, soru, konuşma ve kullanıcı ajanı içermez. Mikrofon testi açık kullanıcı eylemiyle 5 saniye Web Audio AnalyserNode örneklerinden RMS sinyali hesaplar; ses dosyası oluşturmaz veya sunucuya göndermez. Test sırasında tanıma/okuma düğmeleri kilitlenir. Süre bitimi, iptal, yeni sohbet, hesap/görünüm değişimi ve arka plana geçiş akışı/AudioContext kaynaklarını kapatır. Bekleyen izin geç tamamlanırsa yeni dinleme başlatılmaz. Ses sinyali ile konuşma tanıma servisinin erişilebilirliği ayrı değerlendirilir.


Antony sohbeti: Yazılı ve sesli sorular aynı erişilebilir mesaj akışında gösterilir. Enter gönderir, Shift+Enter yeni satır ekler. En fazla 8 konuşma açık sekmede tutulur; yeni sohbet ve hesap değişimi akışı temizler. Sınırlı selamlaşmalar yerel hazır yanıtlardır; serbest sohbet mevcut Qwen yerel modeli gerektirir. Modelin sistem istemi Antony adını kullanır. Kaynaklar ve son yanıt araçları açılır ayrıntılarda korunur.
