# Liquid Lens 2.0

Zeytinyağı ve diğer bitkisel yağlar için **aynı karede görsel karşılaştırma** aracı. Saflık, asitlik, güvenlik, kimyasal bileşim, yağ türü veya karışım oranı belirlemez. Sahtelik tespiti veya %100 doğruluk iddiası yoktur.

## Render

- Branch: `main`
- Root Directory: boş
- Build Command: `npm install --omit=dev`
- Start Command: `npm start`

Node 22 ve üzeri gerekir. Harici çalışma zamanı bağımlılığı yoktur. Sunucu `PORT` değişkenini kullanır ve `0.0.0.0` üzerinde dinler. Kamera için HTTPS veya localhost gerekir.

## Kullanım

1. Yağ türünü, referans ve numune adlarını girin.
2. Aynı tip şeffaf kaplarda eşit yükseklikteki iki yağı aynı sade arka plan önünde yan yana yerleştirin. Hazırlık kutularını işaretleyin.
3. Kamera açın veya iki kabı birlikte gösteren bir fotoğraf yükleyin.
4. Referans ve numune kutularını yağın iç kısmına taşıyın. Önce bölge düğmesini seçip görüntüye dokunabilir, kutuları sürükleyebilir veya kutuya odaklanıp ok tuşlarını kullanabilirsiniz.
5. Ölçümü başlatın. Uygun olmayan çekimlerde verilen düzeltme önerilerini uygulayın.
6. Sonucu cihazınıza kaydedin; JSON, CSV veya tarayıcının yazdır/PDF seçeneğiyle dışa aktarın.

Demo, sentetik bir çizim kullanır ve açıkça etiketlenir. Demo raporları normal kayıt defterine eklenmez. Gerçek kameranın veya kimyasal bir analizin doğrulaması olarak kullanılamaz.

## Yöntem

- Görüntünün `object-fit: cover` ile görünür olan kısmına karşılık gelen iki bölge 64×64 piksele örneklenir.
- Ortalama R/G/B, aritmetik parlaklık `(R+G+B)/3`, kırpılan piksel oranı ve parlaklığın uzamsal standart sapması hesaplanır.
- Kamerada 8 ayrı kare alınır; desteklenen tarayıcılarda video kare geri çağrısı kullanılır. Desteklemeyen tarayıcılarda 180 ms arayla örneklenir. Fotoğrafta yalnızca 1 kare vardır.
- Her bölgenin ölçümlerinin ortancası raporlanır. RGB uzaklığı `sqrt(ΔR²+ΔG²+ΔB²)` (0–441,67), mutlak parlaklık farkı (0–255) ve işaretli kanal farkları gösterilir.
- Ayrı arka plan kontrol bölgesi kullanılmaz; fiziksel kalibrasyon yapılmaz.
- Bir numune alanının parlaklığı 25 altında veya 235 üstündeyse; herhangi bir kanalı ≤3 veya ≥252 olan pikseller %18'i aşıyorsa ölçüm reddedilir.
- Seri boyunca RGB farkının aralığı 10'u veya herhangi bir bölgenin ortanca rengine en büyük RGB uzaklığı 15'i aşıyorsa çekim değişken kabul edilir ve rapor üretilmez.

Bu eşikler pratik çekim filtreleridir; laboratuvarla doğrulanmış sahtelik veya kalite eşikleri değildir. Otomatik kamera ayarları, görüntü sıkıştırma, ışık, kap geometrisi ve yağın doğal renk farkları ölçümü etkiler. Aynı ortalama renk, aynı kimyasal içerik anlamına gelmez. Referansın orijinalliği uygulama tarafından doğrulanmaz. Polarizasyon, spektrometre, fiziksel geçirgenlik veya bulanıklık ölçümü yapılmaz.

Yağların saflık ve kalite analizi hakkında: [Uluslararası Zeytin Konseyi](https://www.internationaloliveoil.org/olive-world/olive-oil/).

## Veriler

Fotoğraflar yerel bellekte işlenir; sunucuya gönderilmez ve kayıtlara eklenmez. En fazla 30 rapor, kullanıcı “Cihaza kaydet” seçerse tarayıcının `localStorage` alanında saklanır. Tarayıcı verilerini temizlemek kayıtları siler. Harici yazı tipi, analiz servisi veya üçüncü taraf istemci bağımlılığı yoktur. Sunucu yalnızca `dist` dosyalarını sunar. İndirilen raporlar kullanıcı tarafından paylaşılabilir.

## Kontroller

`npm test`: bilinen piksel sonuçları, uç değerler, uygunsuz ışık, kararsız seri, görüntü kırpma ve HTTP sunucusu kontrolleri.

İsteğe bağlı tarayıcı testi: kurulu `playwright-core/index.mjs` yolunu `PLAYWRIGHT_MODULE`, Chromium tabanlı tarayıcı yolunu `BROWSER_EXECUTABLE` ortam değişkeniyle verip `node test/browser-smoke.mjs` çalıştırın. Bu test, demo/fotoğraf, kayıt kalıcılığı, JSON indirme, mobil genişlik ve sahte kamera kaynağının yaşam döngüsünü doğrular. Gerçek telefonda kamera/fener ve fiziksel numuneler ayrıca sınanmalıdır.
