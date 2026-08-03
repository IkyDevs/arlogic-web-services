Instruksi UI/UX & Interaktivitas untuk AI

Wajib dibaca AI setiap kali membuat atau mengubah komponen UI apapun. File ini adalah perintah eksekusi, bukan sekadar referensi — AI harus benar-benar mengikuti tiap bagian di bawah, bukan hanya membacanya sekilas.

🎯 MANDAT UTAMA

Saat membuat UI, kamu (AI) bertindak sebagai Senior Product Designer + Motion Designer + Frontend Engineer sekaligus. Target akhirnya bukan "UI yang berfungsi", tapi UI yang terasa premium, hidup, dan menyenangkan dipakai — setara produk-produk kelas atas (Linear, Vercel, Stripe, Framer sendiri).

Setiap komponen yang kamu buat harus lolos pertanyaan ini:

"Kalau user diam-diam disuruh menebak apakah ini dibuat oleh tim desain profesional atau di-generate asal jadi, jawabannya harus: profesional."

Jangan pernah puas dengan versi "yang penting jalan". Selalu iterasi minimal 1 putaran self-critique sebelum menganggap komponen selesai (lihat bagian Self-Review di bawah).

🖌️ PRINSIP DESAIN VISUAL
Ambil satu sikap desain yang jelas untuk tiap project — jangan campur-campur gaya. Tentukan dulu: palet warna (4-6 hex bernama), pasangan tipografi (display + body + utility), dan satu "signature element" yang jadi ciri khas UI ini.
Hindari default generik AI — jangan otomatis pakai kombinasi krem hangat + serif + aksen terracotta, atau dark mode + satu warna neon, kecuali itu memang keputusan sadar untuk brand ini.
Hierarki visual harus jelas dalam 1 detik pertama — mata user harus langsung tahu elemen mana yang paling penting di layar.
Whitespace adalah elemen desain, bukan sisa ruang kosong — gunakan secara sengaja untuk memberi napas dan menuntun fokus.
Konsistensi token: semua warna, spacing, radius, shadow, dan font harus berasal dari design token terpusat (lihat bagian Design Tokens), tidak boleh ada magic number tersebar di kode.
Detail kecil yang menunjukkan kualitas: hover state, focus ring, disabled state, loading state, empty state — semua wajib didesain, bukan dibiarkan default browser.
⚡ UX SUPER INTERAKTIF — WAJIB ADA

Setiap fitur interaktif harus punya respons instan terhadap aksi user. Checklist minimum per komponen:

Elemen	Interaksi Wajib
Button	Hover (scale/color shift), active/press state (scale down sedikit), disabled state yang jelas, loading state dengan spinner/skeleton inline
Card / List item	Hover lift (shadow + slight translateY), klik memberi feedback visual sebelum navigasi
Form input	Focus state animasi (border/glow), validasi real-time dengan transisi halus (bukan muncul tiba-tiba), shake animation untuk error
Modal / Dialog	Enter dengan scale+fade, exit dengan reverse, backdrop fade terpisah, focus trap
Toast / Notification	Slide-in dari arah yang konsisten, auto-dismiss dengan progress bar, bisa di-dismiss manual
Navigasi (tab/menu)	Indicator yang bergerak smooth (shared layout animation) ke tab aktif, bukan jump instan
List / Grid data	Stagger animation saat item muncul pertama kali, smooth reorder saat data berubah
Drag & drop (jika ada)	Visual feedback saat drag (scale up, shadow), placeholder di posisi drop, snap animation
Scroll	Scroll-triggered reveal untuk section panjang, parallax tipis jika sesuai brand (jangan berlebihan)
Skeleton/loading	Setiap fetch data async wajib skeleton loading, bukan spinner polos di tengah layar kosong

Aturan penting: interaktivitas harus purposeful — setiap animasi menjawab pertanyaan "apa yang terjadi" atau "ke mana perhatian user harus pergi", bukan sekadar hiasan. Animasi berlebihan yang tidak fungsional justru terasa murahan dan "AI-generated".

🎬 ANIMASI DENGAN FRAMER MOTION

Framer Motion (motion package) adalah library animasi wajib untuk semua interaksi non-trivial. Aturan penggunaan:

Setup Dasar
tsx
import { motion, AnimatePresence } from "framer-motion";
Pola Wajib per Kasus

1. Fade + slide masuk saat elemen pertama muncul

tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
>

2. Stagger children (list/grid)

tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};
// <motion.ul variants={container} initial="hidden" animate="show">
//   <motion.li variants={item} />

3. Exit animation wajib pakai AnimatePresence

tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    />
  )}
</AnimatePresence>

4. Shared layout animation untuk tab indicator / selection

tsx
{tabs.map((tab) => (
  <button key={tab.id} onClick={() => setActive(tab.id)}>
    {tab.label}
    {active === tab.id && (
      <motion.div layoutId="activeTab" className="underline" />
    )}
  </button>
))}

5. Micro-interaction hover/tap

tsx
<motion.button
  whileHover={{ scale: 1.03 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>

6. Scroll-triggered reveal

tsx
<motion.section
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.5 }}
>
Standar Easing & Durasi (jangan asal angka)
Micro-interaction (hover, tap, toggle): 150–250ms, easing easeOut atau spring ringan
Elemen masuk/keluar (modal, dropdown, toast): 200–350ms
Page/section transition: 350–500ms, easing custom cubic-bezier untuk terasa premium ([0.22, 1, 0.36, 1] sebagai default yang baik)
Jangan pakai linear easing untuk animasi UI — selalu ease-in/out/spring supaya terasa natural
Reduced Motion — WAJIB

Selalu hormati preferensi user yang mematikan animasi:

tsx
import { useReducedMotion } from "framer-motion";
const shouldReduceMotion = useReducedMotion();
// gunakan untuk menonaktifkan/mengurangi animasi non-esensial
📱 RESPONSIVE DESIGN — MOBILE, TABLET, DESKTOP

Setiap komponen wajib didesain untuk 3 breakpoint minimum ini, bukan cuma "auto-shrink":

Breakpoint	Range	Prioritas Desain
Mobile	< 640px	Single column, navigasi jadi bottom nav / hamburger, target tap area min 44x44px, font tidak boleh mengecil di bawah 14px untuk body text
Tablet	640px – 1024px	Layout mulai 2 kolom untuk grid/list, sidebar bisa collapsible, spacing sedikit lebih lega
Desktop	> 1024px	Layout penuh (multi-kolom, sidebar permanen jika relevan), hover state aktif penuh (hover tidak relevan di touch device)
Aturan Wajib
Mobile-first: tulis CSS/style dasar untuk mobile dulu, lalu tambahkan override untuk breakpoint lebih besar — bukan sebaliknya.
Touch target minimum 44x44px di semua elemen interaktif pada mobile/tablet.
Hindari hover-only interaction — semua fungsi yang dipicu hover di desktop harus tetap bisa diakses lewat tap di mobile (mis. tooltip, dropdown).
Test di 3 titik minimum: 375px (mobile kecil), 768px (tablet), 1440px (desktop) — jangan asumsi "kelihatan oke" tanpa cek breakpoint tengah.
Gambar & media responsive: gunakan srcset/sizes atau setara, jangan load gambar desktop-size di mobile.
Navigasi adaptif: navbar horizontal di desktop → hamburger/bottom nav di mobile, bukan navbar yang di-squeeze sampai berantakan.
Grid/layout pakai unit relatif (fr, %, clamp()) untuk tipografi dan spacing yang scale smooth antar breakpoint, bukan hardcode breakpoint per breakpoint kalau bisa dihindari.

Contoh pola clamp untuk tipografi fluid:

css
font-size: clamp(1.5rem, 1rem + 2vw, 2.5rem);
🧩 KOMPLEKSITAS & KEDALAMAN INTERAKSI

Supaya UI terasa "kaya" (bukan template basic), pertimbangkan elemen-elemen ini sesuai konteks fitur — pilih yang relevan, jangan paksakan semua di satu tempat:

Optimistic UI update — perubahan tampil instan sebelum konfirmasi server selesai, dengan rollback halus kalau gagal
Command palette / quick action (⌘K style) untuk aplikasi dengan banyak fitur
Contextual menu (right-click / long-press) untuk aksi cepat
Inline editing — edit langsung di tempat tanpa pindah halaman/modal, dengan animasi transisi state view→edit
Progressive disclosure — sembunyikan kompleksitas di balik "show more"/expand dengan animasi height yang smooth
Multi-step form dengan progress indicator animasi, bukan form panjang sekaligus
Empty state yang mengarahkan aksi — bukan cuma teks "tidak ada data", tapi ilustrasi + CTA jelas
Micro-feedback di setiap aksi penting — checkmark animasi setelah save, confetti/celebration untuk milestone (kalau sesuai brand), haptic-style visual feedback

Prinsip pembatas: kompleksitas ini harus menambah kegunaan atau delight, bukan sekadar menambah jumlah animasi. Kalau ragu apakah suatu efek perlu, tanyakan: "apakah ini bikin user lebih paham/cepat/senang, atau cuma ramai?"

🛠️ IMPLEMENTASI TEKNIS
Gunakan CSS variables / design tokens untuk semua warna, spacing, radius — jangan hardcode value di tiap komponen.
Komponen animasi kompleks (modal, toast, dropdown) sebaiknya dibuat sebagai komponen reusable, bukan copy-paste logic Framer Motion di tiap tempat.
Pisahkan variants Framer Motion ke file/const terpisah kalau dipakai berulang, supaya konsisten timing-nya di seluruh app.
Perhatikan performance: animasi sebaiknya di properti transform dan opacity (GPU-accelerated), hindari animasi width/height/top/left langsung kalau bisa diganti transform.
Untuk list panjang, pertimbangkan virtualization supaya animasi tidak lag saat data banyak.
✅ SELF-REVIEW SEBELUM DIANGGAP SELESAI

Sebelum menyatakan komponen/halaman UI selesai, cek ulang:

 Semua state (default, hover, active, focus, disabled, loading, error, empty) sudah didesain — bukan cuma "happy path"
 Sudah dicek di 3 breakpoint (mobile/tablet/desktop)
 Animasi punya tujuan jelas, bukan sekadar hiasan
 prefers-reduced-motion dihormati
 Touch target cukup besar untuk mobile
 Tidak ada hover-only functionality yang tidak bisa diakses di touch device
 Warna, spacing, font konsisten dengan design token (tidak ada magic number)
 Sudah dicek terhadap a11y.md (kontras, keyboard nav, ARIA)
 Kalau dilihat sekilas, terasa seperti produk premium — bukan template default
📚 Dokumen Terkait
a11y.md — standar aksesibilitas detail (kontras, keyboard, ARIA)
conventions.md — konvensi penamaan komponen & struktur file
architecture.md — struktur folder untuk menaruh komponen UI & animation variants
