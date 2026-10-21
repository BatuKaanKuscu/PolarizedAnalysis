# Liquid Lens · Kiralite kütüphanesi

Kiralite ve stereokimya için Türkçe kaynak kütüphanesi. Ana sayfa, IUPAC/OpenStax bağlantılı rehber, PubChem madde araması ve kullanıcı adıyla hesap/profil akışı vardır. Önceki iki sıvı karşılaştırması, kamera/fotoğraf çekimi ve bunlara bağlı yapay zekâ yorum akışı kaldırılmıştır. Site kamera izni istemez; optik çevirme, enantiyomerik fazlalık veya saflık ölçmez.

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

## Kontroller

`npm test`: hesap, geçiş uyumluluğu, HTTP sunucusu ve kimya kütüphanesi testleri. Tarayıcı kontrolleri `node test/site-smoke.mjs` ve `node test/chemistry-browser.mjs` ile çalıştırılır. Kurulu `playwright-core/index.mjs` yolunu `PLAYWRIGHT_MODULE`, tarayıcı yolunu `BROWSER_EXECUTABLE` ile belirtin. Tarayıcı testleri sahte kütüphane yanıtıyla arayüzü sınar; gerçek PubChem bağlantısı ayrıca doğrulanır.
