# Digiturk Bilgi Portalı

## Çalıştırma

Run düğmesi `npm run dev -- --host 127.0.0.1 --port 5174` çalıştırır. Kimlik verileri `.data/auth.sqlite` içinde tutulur; bu klasör git dışında kalır. Sunucu olmadan açılan statik HTML kimlik doğrulaması sağlayamaz. Kurumsal dağıtımda HTTPS, erişim kısıtlaması ve veritabanı yedekleri gereklidir.

## GitHub Pages dağıtımı

`.github/workflows/pages.yml`, `master` dalına gönderildiğinde `npm ci` ve `npm run build` çalıştırıp `dist` klasörünü GitHub Pages'e dağıtır. Depoda Pages → Build and deployment → Source: **GitHub Actions** seçilmelidir. Vite `base` değeri `/digiturk-internet-bilgi-portali/` olarak ayarlanmıştır; `public/` içindeki manifest, servis çalışanı ve ikonlar proje alt yoluna göre çözülür. `origin` olarak `https://github.com/oznoztrkc/digiturk-internet-bilgi-portali.git` tanımlıdır. Bu ortamda production build veya gerçek Pages erişimi doğrulanamamıştır.

**Önemli:** GitHub Pages statik dosya sunar; mevcut kimlik doğrulama, admin, içerik ve AI uçları yalnızca Vite geliştirme sunucusunun `/api` eklentilerinde çalışır. Pages'e yüklenen dosyalar bu uçları sağlamaz; bu işlevlerin gerçek yayında çalışması için aynı origin altında HTTPS `/api` sunan ayrı bir sunucu/ters proxy gerekir. GitHub Pages tek başına mevcut portalın tamamını çalıştırmaz; statik PWA dosyalarının yayını, çalışan uygulama yayını anlamına gelmez.

## PWA ve Android hazırlığı

Manifest ve uygulama ikonu hazırdır. Service Worker yalnızca manifest ve ikonu önbelleğe alır; portal sayfaları, giriş, içerikler ve AI çevrimdışı çalışmaz. Mikrofon için güvenli HTTPS bağlantısı ve tarayıcı/WebView ses tanıma desteği gerekir.

`capacitor.config.json` Android/iOS için uygulama kimliği, ad ve web çıktı klasörünü tanımlar. Bu dosya **APK üretmez**: Capacitor paketleri ve Android platformu henüz kurulmamıştır. Ayrıca mevcut `/api/auth` ve `/api/chat` uçları Vite sunucusunda çalıştığından `dist` tek başına bir üretim backend'i değildir. APK hazırlamadan önce kimlik doğrulaması ve AI uçlarını erişim kontrollü HTTPS sunucusuna taşıyıp aynı-origin isteklerini sağlayan bir dağıtım mimarisi kurmak gerekir. Geliştirme Run komutu değişmemiştir.

## İlk yönetici hesabı

Projeyi bir kez Run ile açarak veritabanını oluşturun. Ardından terminalde (değerleri kendi bilgilerinizle değiştirin) şu komutu çalıştırın:

```sh
ADMIN_EMAIL='ozan.ozturkci@concentrix.com' ADMIN_PASSWORD='guclu-en-az-10-karakter' ADMIN_FIRST_NAME='Ad' ADMIN_LAST_NAME='Soyad' ADMIN_PHONE='05000000000' node --import tsx server/create-admin.ts
```

Ana yönetici `ozan.ozturkci@concentrix.com` hesabı backend veritabanında ADMIN rolündedir. Yeni kurulumda bu hesap için normal kayıt kapalıdır: yukarıdaki komutta ADMIN_EMAIL değerini bu adresle değiştirerek hesabı oluşturun; hesabın zaten kayıtlı olduğu kurulumda aynı komut mevcut ana hesabı yetkilendirir (şifreyi değiştirmez). Şifreleri komut satırı geçmişinde tutmamak için değişkenleri güvenli bir ortamdan aktarın. Oturumlar HttpOnly çerezle doğrulanır; son aktivite görünür sekmede dakikada bir güncellenir. Tarayıcı kapanışı kesin olarak tespit edilemez: süre son etkinliğe göre raporlanır. Yönetim panelindeki yayınlanmış içerikler AI sohbetin sunucu tarafı bilgi kaynağıdır. Admin panelindeki AI Ayarları alanı anahtarı sunucudaki `.env` dosyasına (izin 0600) kaydeder, değerini tarayıcıya geri göndermez. HTTPS olmadan aktarım güvenli değildir. Çevrimdışı PWA önbelleği kimlik koruması sağlamaz.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
