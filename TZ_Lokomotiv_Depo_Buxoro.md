# TEXNIK TOPSHIRIQ (TZ)

## «Lokomotiv depo xodimlarining bilimini tekshirish va tibbiy ko'rik tizimi» veb-ilovasi

| Maydon | Qiymat |
|---|---|
| Buyurtmachi | «O'zbekiston temir yo'llari» AJ, Buxoro viloyati Lokomotiv deposi |
| Loyiha turi | Veb-ilova (ichki foydalanish uchun) |
| Hujjat versiyasi | 1.0 |
| Sana | 2026-yil, iyun |

---

## 1. LOYIHA HAQIDA UMUMIY MA'LUMOT

1.1. Tizimning maqsadi — depo xodimlarining kasbiy bilimlarini hamda mehnat muhofazasi bo'yicha bilimlarini muntazam tekshirish va har kungi tibbiy ko'rik natijalarini yagona elektron tizimda yuritish.

1.2. Tizim uchta asosiy moduldan iborat:

1. **Mutaxassislik bo'yicha bilimlarni tekshirish** — AI tomonidan yo'riqnomalar asosida yaratilgan testlar, savollar ovozli o'qib eshittiriladi (TTS), shaxs Face ID orqali tasdiqlanadi.
2. **Mehnat muhofazasi bo'yicha bilimlarni tekshirish** — texnika xavfsizligi va sanoat xavfsizligi yo'nalishlarida testlar, savollar ovozsiz (faqat matn).
3. **Tibbiy ko'rik** — arterial qon bosimi, puls, saturatsiya, alkotester natijalari hamda ish/dam olish soatlarini qayd etish va xulosa chiqarish.

1.3. Tizim brauzer orqali ochiladi va kamera ulangan kompyuterda ishlashi shart (Face ID uchun).

---

## 2. TEXNOLOGIYALAR STEKI

| Qatlam | Texnologiya |
|---|---|
| Frontend | React (JavaScript) |
| Backend | Python, Django, Django REST Framework |
| Ma'lumotlar bazasi | PostgreSQL |
| Yuzni aniqlash | Server tomonda yuz embedding'larini solishtirish (masalan, InsightFace yoki face_recognition) |
| AI test generatsiyasi | LLM API (masalan, Anthropic Claude API) |
| Ovozlashtirish (TTS) | Savollarni ovozli o'qish xizmati (til va xizmat 15-bo'limda kelishiladi) |
| Kamera bilan ishlash | WebRTC — getUserMedia |
| Joylashtirish | Linux server, Nginx + Gunicorn (Docker — ixtiyoriy) |

---

## 3. FOYDALANUVCHI ROLLARI VA AKKAUNTLAR

3.1. Tizimda uch turdagi akkaunt bo'ladi:

| № | Akkaunt | Soni | Vazifasi |
|---|---|---|---|
| 1 | Mutaxassislar akkaunti | 1 ta (umumiy) | Barcha xodimlar test topshirish uchun shu akkauntdan kiradi |
| 2 | Administrator | 1 ta | Xodimlar, testlar, yo'riqnomalar va natijalarni boshqaradi |
| 3 | Tibbiyot xodimi | 1 ta | Kundalik tibbiy ko'rik ma'lumotlarini kiritadi |

3.2. Ruxsatlar:

- **Mutaxassislar akkaunti** — faqat test topshirish oqimi; natijalarni ko'rish testdan keyingi ekran bilan cheklanadi, hech narsani o'zgartira olmaydi.
- **Administrator** — to'liq boshqaruv: xodimlar, mutaxassisliklar, yo'riqnomalar, testlar, natijalar, hisobotlar, akkauntlar.
- **Tibbiyot xodimi** — tibbiy ko'rik yozuvlarini kiritish va tarixini ko'rish.

3.3. Avtorizatsiya login/parol orqali amalga oshiriladi. Parollar xeshlangan holda saqlanadi, rollar bo'yicha ruxsatlar server tomonda tekshiriladi.

---

## 4. XODIMLAR BAZASI

4.1. Xodimlar bazasini administrator yuritadi. Har bir xodim kartochkasi quyidagi maydonlardan iborat:

| Maydon | Tavsif | Majburiy |
|---|---|---|
| F.I.Sh. | To'liq familiya, ism, sharif | Ha |
| Mutaxassislik | Ro'yxatdan tanlanadi | Ha |
| Fotosurat | Face ID uchun etalon surat (old tomondan, aniq) | Ha |
| Holat | Faol / Faol emas | Ha |

4.2. Mutaxassisliklar ro'yxati (administrator tomonidan kengaytirilishi mumkin):

1. Mashinist
2. Mashinist yordamchisi
3. Depo navbatchisi
4. Chilangar
5. O'quv ishlari bo'yicha mashinist
6. O'quv ishlari bo'yicha bosh usta

4.3. Fotosurat yuklanganda tizim undan yuz embedding (raqamli iz) yaratib saqlaydi — Face ID solishtirish shu asosda bajariladi. Suratda yuz aniqlanmasa, tizim ogohlantiradi va boshqa surat so'raydi.

---

## 5. MODUL 1 — MUTAXASSISLIK BO'YICHA BILIMLARNI TEKSHIRISH

### 5.1. Test bazasini shakllantirish

5.1.1. Administrator har bir mutaxassislik uchun depo yo'riqnomalarini (PDF, DOCX yoki matn) tizimga yuklaydi.

5.1.2. AI yuklangan yo'riqnoma asosida testlarni avtomatik generatsiya qiladi. Har bir test quyidagilardan iborat:

- savol matni;
- 4 ta javob varianti;
- 1 ta to'g'ri javob;
- qaysi mutaxassislikka tegishliligi.

Bir generatsiyada yaratiladigan savollar soni sozlanadi.

5.1.3. AI yaratgan testlar avval «Tasdiqlanmagan» holatda turadi. Administrator ularni ko'rib chiqadi, tahrirlaydi, tasdiqlaydi yoki o'chiradi. Xodimlarga faqat tasdiqlangan testlar chiqadi.

5.1.4. Administrator testlarni qo'lda ham qo'shishi, tahrirlashi va o'chirishi mumkin.

### 5.2. Test topshirish jarayoni

1. Mutaxassislar akkauntiga kiriladi.
2. Xodim ro'yxatdan o'z F.I.Sh.ini tanlaydi (qidiruv bilan).
3. **Face ID tekshiruvi:** xodim kameraga qaraydi, tizim jonli tasvirni bazadagi etalon fotosurat bilan solishtiradi.
4. Yuz mos kelmasa yoki aniqlanmasa — test **boshlanmaydi**, ekranda ogohlantirish chiqadi, urinish jurnalga yoziladi.
5. Yuz tasdiqlansa — tizim xodim mutaxassisligiga tegishli tasdiqlangan testlardan **10 tasini tasodifiy** tanlab beradi.
6. Har bir savol ekranda ko'rsatiladi va **AI ovozi (TTS) orqali o'qib eshittiriladi**. «Qayta eshitish» tugmasi nazarda tutiladi.
7. Xodim har bir savolga bitta javobni belgilab, keyingisiga o'tadi.
8. Test yakunida natija avtomatik hisoblanadi va bazaga saqlanadi.

### 5.3. Saqlanadigan natija ma'lumotlari

- xodim va uning mutaxassisligi;
- boshlanish va tugash sanasi-vaqti;
- chiqqan savollar, berilgan javoblar, to'g'ri/noto'g'ri belgisi;
- umumiy ball (masalan, 10 tadan 8 ta to'g'ri);
- Face ID muvaffaqiyatli o'tilgani fakti;
- o'tdi / o'tmadi holati (o'tish bali — 15-bo'limda kelishiladi).

---

## 6. MODUL 2 — MEHNAT MUHOFAZASI BO'YICHA BILIMLARNI TEKSHIRISH

6.1. Modul ikki yo'nalishdan iborat:

1. **Texnika xavfsizligi** testlari;
2. **Sanoat xavfsizligi** testlari.

6.2. Test bazasi **faqat administrator paneli orqali qo'lda** shakllantiriladi: savol matni, 4 ta variant, 1 ta to'g'ri javob, yo'nalish.

6.3. Test topshirish jarayoni 5.2-banddagi kabi, quyidagi farqlar bilan:

- xodim avval yo'nalishni tanlaydi (texnika xavfsizligi yoki sanoat xavfsizligi);
- savollar **ovozlashtirilmaydi** — faqat matn ko'rinishida ko'rsatiladi;
- savollar soni — 10 ta (tasodifiy tanlanadi).

6.4. Face ID tekshiruvi 1-modul bilan bir xil: yuz tasdiqlanmasa test boshlanmaydi.

6.5. Natijalar 5.3-banddagi kabi, yo'nalish ko'rsatilgan holda saqlanadi.

---

## 7. MODUL 3 — TIBBIY KO'RIK

7.1. Tibbiyot xodimi akkaunti orqali har kuni har bir xodim bo'yicha quyidagi ma'lumotlar kiritiladi:

| Maydon | Tavsif |
|---|---|
| Xodim | Ro'yxatdan tanlanadi (F.I.Sh. bo'yicha qidiruv) |
| Sana va vaqt | Avtomatik qo'yiladi |
| Arterial qon bosimi (AQB) | Sistolik / diastolik (masalan, 120/80) |
| Puls | Daqiqasiga urishlar soni |
| Saturatsiya (SpO₂) | Foizda |
| Alkotester natijasi | Qiymat yoki manfiy/musbat (format 15-bo'limda kelishiladi) |
| Ishlagan soatlari | Oxirgi smenada necha soat ishlagani |
| Dam olgan soatlari | Smenadan keyin necha soat dam olgani |
| Xulosa | **Ruxsat berildi / Rad etildi** |
| Izoh | Ixtiyoriy matn maydoni |

7.2. Tizim har bir yozuvni kim va qachon kiritganini avtomatik qayd etadi.

7.3. Saqlangan xulosani keyinchalik o'zgartirish taqiqlanadi (yoki faqat administrator ruxsati bilan — 15-bo'limda kelishiladi); audit uchun barcha o'zgarishlar tarixi saqlanadi.

7.4. Tarix va qidiruv: xodim bo'yicha, sana oralig'i bo'yicha, xulosa bo'yicha filtrlash; ro'yxat va batafsil ko'rinish.

7.5. Tavsiya: ko'rsatkichlar me'yordan chetga chiqsa (masalan, alkotester musbat bo'lsa), forma vizual ogohlantiradi; yakuniy qarorni har doim tibbiyot xodimi qabul qiladi.

---

## 8. ADMINISTRATOR PANELI

8.1. Asosiy funksiyalar:

1. **Xodimlar** — qo'shish, tahrirlash, arxivlash, fotosurat yuklash.
2. **Mutaxassisliklar** — ro'yxatni boshqarish.
3. **Yo'riqnomalar** — yuklash va AI test generatsiyasini ishga tushirish (1-modul uchun).
4. **Testlar** — barcha modullar bo'yicha qo'shish / tahrirlash / o'chirish / tasdiqlash.
5. **Natijalar** — test natijalari va tibbiy ko'rik yozuvlarini ko'rish; xodim, mutaxassislik, modul va sana bo'yicha filtrlash.
6. **Eksport** — natijalarni Excel (XLSX) formatida yuklab olish.
7. **Akkauntlar** — parollarni almashtirish.

8.2. Panel faqat administrator roli uchun ochiq.

---

## 9. ASOSIY EKRANLAR (SAHIFALAR)

**Mutaxassislar akkaunti:**

1. Kirish sahifasi
2. Modul tanlash (Mutaxassislik testi / Mehnat muhofazasi)
3. Xodimni tanlash (fotosuratli ro'yxat, F.I.Sh. bo'yicha qidiruv)
4. Face ID tekshiruvi (kamera oynasi, holat indikatorlari)
5. Test sahifasi (savol, variantlar, jarayon ko'rsatkichi 1/10, 1-modulda TTS tugmasi)
6. Natija sahifasi (ball, o'tdi/o'tmadi)

**Tibbiyot xodimi:**

1. Kirish sahifasi
2. Tibbiy ko'rik kiritish formasi
3. Bugungi yozuvlar ro'yxati va umumiy tarix

**Administrator:**

1. Kirish sahifasi
2. Boshqaruv paneli (kunlik statistika: testlar, tibbiy ko'riklar)
3. Xodimlar bo'limi
4. Testlar va yo'riqnomalar bo'limi
5. Natijalar va hisobotlar bo'limi

---

## 10. MA'LUMOTLAR BAZASI — DASTLABKI SXEMA

Jadval nomlari shartli, ishlab chiqish jarayonida aniqlashtiriladi:

| Jadval | Asosiy maydonlar |
|---|---|
| `specialties` | id, name |
| `employees` | id, full_name, specialty_id, photo, face_embedding, is_active, created_at |
| `instructions` | id, specialty_id, title, file, uploaded_at |
| `questions` | id, module (specialty / tech_safety / industrial_safety), specialty_id, text, options, correct_option, source (ai / manual), status (draft / approved), created_at |
| `test_sessions` | id, employee_id, module, direction, started_at, finished_at, score, total, passed, face_verified |
| `test_answers` | id, session_id, question_id, selected_option, is_correct |
| `medical_checks` | id, employee_id, date_time, bp_systolic, bp_diastolic, pulse, saturation, alcohol_result, hours_worked, hours_rested, conclusion, note, medic_user_id, created_at |
| `users` | Django standart jadvali + role maydoni (specialist / admin / medic) |

---

## 11. NOFUNKSIONAL TALABLAR

11.1. **Interfeys tili** — o'zbek (lotin). Zarurat bo'lsa, keyinchalik rus tili qo'shilishi mumkin.

11.2. **Xavfsizlik:**

- HTTPS majburiy (getUserMedia kamera funksiyasi faqat HTTPS yoki localhost'da ishlaydi);
- rolga asoslangan ruxsatlar server tomonda tekshiriladi;
- parollar xeshlanadi, sessiya muddati cheklanadi;
- Face ID urinishlari (muvaffaqiyatli va muvaffaqiyatsiz) jurnalga yoziladi.

11.3. **Brauzerlar:** Chrome va Edge'ning so'nggi versiyalari.

11.4. **Interfeys:** birinchi navbatda desktop (kamerali ish stansiyasi) uchun, moslashuvchan dizayn.

11.5. **Ishonchlilik:** kunlik avtomatik zaxira nusxa (PostgreSQL dump); natijalarning saqlanish muddati buyurtmachi bilan kelishiladi.

11.6. **Unumdorlik:** bir vaqtning o'zida kamida 20–30 foydalanuvchi; sahifalar 2 soniyadan tez ochilishi.

---

## 12. TASHQI XIZMATLAR VA INTEGRATSIYALAR

12.1. **AI test generatsiyasi.** Yo'riqnoma matni bo'laklarga ajratiladi, har bir bo'lakdan LLM API yordamida savollar yaratiladi. Natija tizimga «Tasdiqlanmagan» holatda yoziladi va administrator tasdiqlagandan keyingina ishlatiladi.

12.2. **TTS (ovozlashtirish).** 1-modul savollarini ovozli o'qish uchun xizmat tanlanadi. Tilni qo'llab-quvvatlash bo'yicha variantlar buyurtmachiga taqdim etiladi va kelishiladi.

12.3. **Yuzni aniqlash.** Server tomonda amalga oshiriladi: etalon fotosuratdan embedding olinadi va kameradan kelgan kadr bilan solishtiriladi. O'xshashlik chegarasi (threshold) sozlanadi. Tavsiya: suratni ko'rsatib aldashdan himoya (liveness tekshiruvi) alohida kelishiladi.

---

## 13. ISHLAB CHIQISH BOSQICHLARI

| Bosqich | Mazmuni |
|---|---|
| 1 | Dizayn maketi va ma'lumotlar bazasi sxemasini tasdiqlash |
| 2 | Backend: modellar, API, rollar va avtorizatsiya |
| 3 | Administrator paneli: xodimlar va testlarni boshqarish |
| 4 | 1-modul: Face ID, AI generatsiya, TTS, test oqimi |
| 5 | 2-modul: mehnat muhofazasi testlari |
| 6 | 3-modul: tibbiy ko'rik |
| 7 | Hisobotlar va Excel eksport |
| 8 | Sinov, xatolarni tuzatish, serverga joylashtirish, foydalanuvchilarni o'qitish |

Muddatlar buyurtmachi bilan alohida kelishiladi.

---

## 14. QABUL QILISH MEZONLARI

Tizim quyidagi shartlar bajarilganda qabul qilingan hisoblanadi:

1. Uchala akkaunt turi ishlaydi, ruxsatlar to'g'ri chegaralangan.
2. Test faqat xodim ro'yxatdan tanlanib, Face ID tekshiruvidan o'tgandagina boshlanadi; begona yuz bilan test ochilmaydi.
3. 1-modulda 10 ta tasodifiy savol chiqadi, savollar TTS orqali o'qiladi, natija saqlanadi.
4. 2-modulda ikkala yo'nalish bo'yicha testlar ishlaydi (ovozsiz).
5. AI yo'riqnomadan testlar yaratadi, administrator ularni tasdiqlaydi; administrator testlarni qo'lda qo'shish va o'chirish imkoniga ega.
6. Tibbiy ko'rik formasi barcha ko'rsatkichlarni qabul qiladi va «Ruxsat berildi / Rad etildi» xulosasi bilan saqlaydi; tarix ko'rish mumkin.
7. Natijalar filtrlash va Excel eksport bilan ishlaydi.

---

## 15. KELISHILISHI LOZIM BO'LGAN OCHIQ MASALALAR

1. O'tish bali: 10 savoldan nechta to'g'ri javob «o'tdi» hisoblanadi?
2. Test uchun vaqt chegarasi kerakmi (umumiy yoki har bir savolga)?
3. Testni qayta topshirish qoidalari: qachon va necha martagacha ruxsat etiladi?
4. TTS tili va ovozi: o'zbek (lotin), rus yoki ikkalasi?
5. Alkotester natijasi formati: raqamli qiymat (‰ / mg/l) yoki faqat «manfiy/musbat»?
6. Tibbiy xulosani keyinchalik tahrirlash mumkinmi, kim tomonidan?
7. Face ID tasdiqlash kadri (foto) natija bilan birga saqlansinmi?
8. Chop etish uchun hisobot blankalari kerakmi?
9. Server qayerda joylashadi: depo ichki tarmog'i yoki bulut/VPS?
10. AI generatsiya uchun yo'riqnomalar qaysi tilda (testlar shu tilda yaratiladi)?
