# MeevCMD — دليل الطاقم | Meev Staff Terminal Guide

> **MeevCMD v20** — طرفية إدارة منصّة Meev.
> The Meev platform's staff & admin command terminal — Arabic first, English follows.

---

## 1) ما هو MeevCMD؟ / What is MeevCMD?

**MeevCMD** هي واجهة الإدارة على شكل طرفية (Terminal) لمplatform Meev، ولها شكلان يعملان على **نفس محرّك الأوامر** نفسه (`src/lib/meev/admin.ts`):

**MeevCMD** is the staff command surface of the Meev platform. It exists in **two forms that share ONE command engine** (`src/lib/meev/admin.ts`):

| السطح / Surface | ما هو / What it is | كيف تدخل / How to open |
|---|---|---|
| 🖥️ **الطرفية داخل التطبيق** In-app terminal | لوحة "MeevCMD" داخل الموقع (قائمة الحساب → MeevCMD) — سطر أوامر حقيقي مع سجل أوامر ولوحة تدقيق | يسجل دخوله أي عضو طاقم (support فأعلى) — يظهر زر MeevCMD في قائمة الحساب مع رتبته |
| 💣 **طرفية CMD حقيقية** Real CLI | ملف في ملفات الموقع نفسها: `meev-cli.ts` — طرفية تفاعلية كاملة (REPL) تعمل بـ **bun** مباشرة على قاعدة البيانات | `bun meev-cli.ts` (تفاعلية) أو `bun meev-cli.ts "whois @mochi"` (أمر واحد) |

- كلا الشكلين يخرجان من **نفس المحرّك** (نفس الأوامر، نفس الصلاحيات، نفس سجل التدقيق AuditLog، نفس الإشعارات للمستخدم المستهدف عبر خدمة الوقت الحقيقي :3003).
- الطرفية الحقيقية **تفتح دائماً بصلاحيات المالك (owner)** — لأنها المسار اليدوي على مستوى قاعدة البيانات. أوامر إضافية خاصة بها فقط: `owner`, `superadmin`, `owner-setup`, `users`, `logs`, `sessions`, `passreset`.

---

## 2) سلّم الإدارة / The staff ladder

```
user (0)  <  support (1)  <  moderator (2)  <  admin (3)  <  superadmin (4) ⚡  <  owner (5) 👑
```

**عقيدة v20 — «قوة محدودة عمداً» / v20 doctrine — limited by design:**

| الرتبة | الوسم | ما تستطيع / Powers |
|---|---|---|
| **user (0)** | — | مستخدم عادي. يرى `help` فقط في الطرفية. |
| **support (1)** | 🎧 cyan | **يرد على التذاكر ويساعد الناس فقط**: مكتب التذاكر (`tickets` · `ticket <id>` · `reply <id> <نص>`) · `whois` — لا صلاحيات عقابية إطلاقاً |
| **moderator (2)** | ⚙️ emerald | كل أوامر support + `mute` / `unmute` · `strikes` · `clear` — إنفاذ بلا صلاحيات حسابات |
| **admin (3)** | 🛡️ violet | كل أوامر moderator (تذاكر + كتم + أوامر بسيطة) — **قوة محدودة عمداً: لا توثيق · لا رتب · لا شارات · لا ذهب · لا حظر** |
| **superadmin (4)** | ⚡ rose→gold | كل أوامر admin + `ban` / `unban` (بحد أقصى **30 يوماً**) · `verify` / `unverify` · `coins ±N` |
| **owner (5)** | 👑 gold | **كل شيء** + حصراً: `role` (تعيين الرتب) · `delete` (حذف نهائي) · `audit` (سجل تدقيق كل عمليات الفريق) + أوامر الطرفية الحقيقية كلها |

قواعد حماية مدمجة / built-in protections:

- 🚫 لا يمكن كتم أو حظر عضو من نفس رتبتك أو أعلى (`roleRank(target) >= roleRank(actor)`).
- 🚫 المالك لا يمكن كتمه/حظره/تغيير رتبته/حذفه.
- 🚫 حظر superadmin محدود بـ 30 يوماً — الأطول/الدائم للمالك (owner) فقط.
- 🔐 عند الحظر: تُنهى فوراً كل جلسات الضحية ورموز التحديث (Session + RefreshToken) ويُطرد من كل الأجهزة (`socket:force-signout`).
- 📜 كل عملية إدارة تُسجّل في **AuditLog** (من قام، ماذا، متى، من أي IP) — **بما فيها ردود التذاكر (`ticket_reply`) باسم الموظف** — ويصل المستخدم إشعار ثنائي اللغة. المالك يراقب الكل بأمر `audit` ولوحة التدقيق في الطرفية.

## 3) كيف تمنح رتبة؟ / HOW TO GRANT A ROLE ⭐

هذا هو الجواب الذي سأله المالك — **ثلاث طرق**:

This is the owner's most-asked question — **three ways**:

### (أ) داخل التطبيق — كمالك / In-app, as owner

سجّل دخولك بحساب المالك (مثلاً `othman`) → افتح **MeevCMD** من قائمة الحساب → اكتب:

```
role @someone support
role @someone moderator
role @someone admin
role @someone user        ← لإرجاعه مستخدماً عادياً
```

### (ب) من طرفية CMD الحقيقية / From the real CLI

```bash
cd /home/z/my-project
bun meev-cli.ts "role @someone moderator"     # أمر واحد / one-shot
bun meev-cli.ts                               # أو طرفية تفاعلية ثم اكتب الأمر
```

> أوامر الرتب متاحة للمالك فقط — الطرفية الحقيقية تفتح دائماً بحساب المالك (role='owner').

### (ج) SQL مباشر — للطوارئ فقط / Direct SQL — emergencies only

عندما لا يعمل الموقع ولا الطرفية (قاعدة البيانات نفسها سليمة):

```bash
cd /home/z/my-project
sqlite3 db/custom.db "UPDATE User SET role='admin' WHERE username='someone';"
# تحقّق:
sqlite3 db/custom.db "SELECT username, role FROM User WHERE username='someone';"
```

أو بأداة Prisma:

```bash
cd /home/z/my-project
bun -e 'import { PrismaClient } from "@prisma/client"; const db = new PrismaClient();
  await db.user.update({ where: { username: "someone" }, data: { role: "admin" } });
  console.log("done"); process.exit(0)'
```

> ⚠️ تعيين رتبة **owner** من داخل التطبيق **ممنوع بتصميم** (`role` ترفض `owner`) — الطريقان الآمنان له: أمر الطرفية `owner <username>` / `owner-setup <username>` (أنظر القسم 4)، أو SQL يدوي في الطوارئ.

### مصفوفة الصلاحيات / Permissions matrix

✅ يعمل، — ممنوع. **اكتب `help` في الطرفية لرؤية هذه المصفوفة كاملة داخل الموقع** (v20).

| الأمر | user (0) | support (1) | moderator (2) | admin (3) | superadmin (4) | owner (5) |
|---|---|---|---|---|---|---|
| `help` (مصفوفة الرتب كاملة) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `tickets` / `ticket` / `reply` (مكتب الدعم) | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `whois @user` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `strikes @user` | — | — | ✅ | ✅ | ✅ | ✅ |
| `mute` / `unmute @user` | — | — | ✅ | ✅ | ✅ | ✅ |
| `clear @user` (مسح المخالفات) | — | — | ✅ | ✅ | ✅ | ✅ |
| `ban` / `unban @user` | — | — | — | — | ✅ (≤30d) | ✅ (أي مدة) |
| `verify` / `unverify @user` | — | — | — | — | ✅ | ✅ |
| `coins @user +500|-100` | — | — | — | — | ✅ | ✅ |
| `role @user <رتبة>` | — | — | — | — | — | ✅ |
| `delete @user confirm` | — | — | — | — | — | ✅ |
| `audit [صفحة] [@user]` | — | — | — | — | — | ✅ |
| **CLI-only:** `owner`, `owner-setup`, `users`, `logs`, `sessions`, `passreset` | — | — | — | — | — | ✅ (طرفية CMD فقط) |

## 4) صلاحيات المالك + `owner-setup` / Owner powers & owner-setup

### قائمة صلاحيات المالك (rank 5)

- كل أوامر الطاقم أعلاه بلا حدود (حظر دائم، منح ذهب بلا سقف…).
- `role` — تعيين رتب support / moderator / admin (وإرجاع user).
- `delete @user confirm` — حذف حساب نهائياً مع كل بياناته (منشورات، رسائل، هدايا… تُمحى بالتسلسل Cascade).
- `audit [صفحة] [@user]` — **عين المالك على كل شيء**: من أعطى كوين، من كتم، من رد على تذكرة — بالاسم والوقت والتفاصيل (25 عملية/صفحة · تصفية بموظف: `audit @othman`).
- من الطرفية الحقيقية فقط:
  - `owner <username>` — ترقية حساب إلى **owner** (المسار اليدوي الذي يحظره التطبيق بتصميم).
  - `owner-setup <username|email>` — التجهيز الكامل (أنظر تحت).
  - `sessions <user> [revoke]` — عرض/إنهاء الجلسات النشطة.
  - `passreset <user> <newPass>` — إعادة تعيين كلمة مرور.

### `owner-setup` — التجهيز الكامل بضغطة واحدة

الأمر (من الطرفية الحقيقية فقط):

```bash
bun meev-cli.ts "owner-setup othman"     # أو أي username/email
```

ما يفعله / what it does (آمن للتكرار — idempotent):

| الحقل | القيمة |
|---|---|
| `role` | `owner` |
| `xp` | `30000` → **المستوى 999** (أسطورة 👑 — XP_PER_LEVEL = 24) |
| `coins` | `999,999` 🪙 ذهب Meev (+ سجل `CoinLog` reason=`seed` إذا زاد الرصيد فعلاً) |
| `verifiedAt` | الآن (شارة التوثيق ✅) |
| `avatarAnim` | `true` (أفاتار متحرك) |
| `lastSpinAt` | `null` (عجلة الحظ جاهزة فوراً) |
| `UserItem` | صف لكل عنصر في **ShopCatalog** كله (مفتاح فريد userId+itemKey — التكرار آمن) |

يطبع ملخصاً بكل ما تغيّر ويسجّل `cli_owner_setup` في AuditLog.

### ملاحظات أمنية / Security notes

- 📜 **سجل تدقيق كامل**: كل أمر إدارة (داخل التطبيق أو الطرفية) يُسجَّل في AuditLog — أوامر الطرفية تظهر بعلامة `cli_` و ip=`cli`. راجعها بأمر `logs 20` أو من لوحة التدقيق في الطرفية داخل الموقع.
- 🔐 الحظر يُنهي الجلسات والرموز فوراً ويطرد المستخدم من كل الأجهزة (force-signout) — لا يمكنه البقاء داخل الموقع بعد الحظر.
- 🔐 `passreset` يرفض كلمات المرور الضعيفة (`checkPasswordStrength`)، ينهي كل الجلسات والرموز، يفك قفل الدخول الفاشل، ويُشعر المستخدم — **ولا يطبع كلمة المرور أبداً** ولا يتركها في سجل أوامر الطرفية (↑/↓ history).
- 🛡️ الرتب محمية: لا أحد يكتم/يحظر/يغير رتبة من هو أعلى منه أو مثله، والمالك محصّن من كل العقوبات.
- 💣 `delete` يتطلب كلمة `confirm` صريحة: `delete @user confirm`.
- ⚠️ تعيين `owner` غير متاح داخل التطبيق (بتصميم) — من الطرفية الحقيقية (`owner` / `owner-setup`) أو SQL طوارئ فقط.

---

## 5) جدول كل الأوامر / All commands reference

### أوامر المحرّك (تعمل في التطبيق وفي الطرفية) / Engine commands (in-app + CLI)

| الأمر | الصيغة | الوصف |
|---|---|---|
| `help` | `help` | قائمة الأوامر مع رتبتك |
| `tickets` | `tickets [open]` | صندوق تذاكر الدعم: 🆕 تنتظر رداً بشرياً · ✅ تم الرد — `tickets open` = المفتوحة فقط |
| `ticket` | `ticket <id>` | قراءة التذكرة كاملة: من، التصنيف، الموضوع، الرسالة (والرد إن وُجد) |
| `reply` | `reply <id> <نص الرد>` | الرد البشري على التذكرة — يستبدل الرد الآلي ويصل المستخدم فوراً 💬 |
| `whois` | `whois @user` | كل بيانات الحساب: id، بريد، رتبة، مستوى، ذهب، مخالفات، كتم/حظر |
| `mute` | `mute @user 30m\|2h\|7d [سبب]` | كتم مؤقت من المراسلة |
| `unmute` | `unmute @user` | فك الكتم |
| `ban` | `ban @user 30d\|permanent [سبب]` | حظر من الدخول (ينهي كل الجلسات فوراً) |
| `unban` | `unban @user` | فك الحظر |
| `verify` | `verify @user` | منح شارة التوثيق ✅ |
| `unverify` | `unverify @user` | إزالة التوثيق |
| `coins` | `coins @user +500` / `-100` | منح/خصم ذهب Meev (مع CoinLog) |
| `strikes` | `strikes @user` | عرض سجل المخالفات |
| `clear` | `clear @user` | مسح المخالفات وفك الكتم |
| `role` | `role @user support\|moderator\|admin\|user` | تغيير الرتبة — **owner فقط** |
| `delete` | `delete @user confirm` | حذف الحساب نهائياً — **owner فقط** |
| `audit` | `audit [صفحة] [@user]` | سجل تدقيق كل عمليات الفريق (من فعل ماذا ومتى) — **owner فقط** (v20) |

### أوامر الطرفية الحقيقية فقط / CLI-only (`bun meev-cli.ts`)

| الأمر | الصيغة | الوصف |
|---|---|---|
| `owner` | `owner <username>` | ترقية إلى owner (يرفض إذا كان owner أصلاً) |
| `owner-setup` | `owner-setup <user\|email>` | التجهيز الكامل للمالك — أنظر القسم 4 |
| `users` | `users [n]` (افتراضي 15) | جدول أحدث المستخدمين: رتبة، مستوى، ذهب، أعلام التوثيق/الحظر/الكتم |
| `logs` | `logs [n]` (افتراضي 20) | آخر سجلات AuditLog: الوقت، الإجراء، الفاعل، IP، ملخص |
| `sessions` | `sessions <user>` | جلسات المستخدم النشطة (جهاز، IP، آخر ظهور) |
| `sessions revoke` | `sessions <user> revoke` | إنهاء كل الجلسات + طرد فوري من الأجهزة |
| `passreset` | `passreset <user> <newPass>` | إعادة تعيين كلمة مرور (تُنهي كل الجلسات) |
| `cls` | `cls` | مسح الشاشة |
| `exit` / `quit` | `exit` | الخروج (أو Ctrl+C / Ctrl+D) |

---

## 6) مكتب الدعم — دورة التذاكر كاملة / Support desk (v19)

### طريق المستخدم / The user's path

**الإعدادات → الدعم → «تذكرة جديدة»** → تصل التذكرة **فوراً** إلى مكتب الدعم بحالة 🆕 مفتوحة (تنتظر رداً بشرياً)، ويستلم المستخدم **رداً آلياً فورياً** لتطمينه + إشعاراً بأن تذكرته وصلت.

### طريق الفريق / The staff path (رتبة support فأعلى)

من لوحة **MeevCMD** داخل التطبيق أو طرفية `meev-cli.ts` — نفس المحرّك:

| الأمر | ماذا يعمل |
|---|---|
| `tickets` | صندوق التذاكر: 🆕 تنتظر رداً بشرياً · ✅ تم الرد (مع `tickets open` لعرض المنتظرة فقط) |
| `ticket <id>` | قراءة التذكرة كاملة: من، التصنيف، الموضوع، الرسالة كاملة |
| `reply <id> نص الرد` | الرد البشري — يستبدل الرد الآلي ويصل المستخدم |

```
meev> tickets
📋 صندوق تذاكر الدعم / support desk — الكل (2)
   🆕 تنتظر رداً بشرياً: 1 · ✅ تم الرد: 1
   ✅ #544641 · @mochi · «خلل في العجلة» · خلل في الموقع · 10d
   🆕 #531204 · @luna · «لم تصلني هدية أرسلتها» · الهدايا والذهب · 9d
meev> ticket 544641
meev> reply 544641 شكراً لتوضيحك! الحل: ...
```

### ماذا يحدث للمستخدم عند الرد؟

- 🔔 **إشعار فوري**: «💬 ردّ فريق الدعم على تذكرتك» (+ 📬 دفعة لحظية إذا كان متصلاً عبر خدمة الوقت الحقيقي :3003)
- 📋 في **«تذاكري»** (الإعدادات → الدعم): رسالته + فقاعة **«فريق ميف»** بالرد الحقيقي + شارة **«تم الرد»** — الرد البشري **يستبدل الرد الآلي** نهائياً
- 📜 **كل رد يُسجّل في سجل التدقيق** (AuditLog: `ticket_reply`) مع اسم الموظف — راجعه بأمر `logs`

### ملاحظات دقيقة

- **رقم التذكرة**: `tickets` يعرض الرقم المختصر `#xxxxxx` — و `ticket` / `reply` يقبلان المختصر أو الرقم الكامل.
- **نص الرد** يمر بنفس فلتر الكلمات (الحماية تعمل في الاتجاهين — حتى من الفريق).
- **تذكرة واحدة لكل أسبوع** لكل مستخدم: المحادثة تُستكمل داخل نفس التذكرة لا بتذاكر جديدة.
- يرى `tickets` آخر 30 تذكرة (الأحدث أولاً) — استخدم `tickets open` لمتابعة المتأخرة فقط.

---

## 7) تشغيل الطرفية الحقيقية / Running the real CLI

```bash
cd /home/z/my-project

bun meev-cli.ts                          # طرفية تفاعلية: لافتة + سجل أوامر (↑/↓) + meev> prompt
bun meev-cli.ts "whois @mochi"           # أمر واحد ثم خروج (exit code 0 نجاح / 1 فشل)
bun meev-cli.ts "role @luna moderator"   # مثال: منح رتبة من سطر واحد
bun meev-cli.ts --help                   # شرح الاستخدام
```

- تعمل بـ **bun** مباشرة — تقرأ `.env` تلقائياً (DATABASE_URL) وتستورد وحدات الموقع نفسها (`@/lib/...`).
- تفتح دائماً بحساب المالك (أول `role='owner'` في القاعدة — افتراضياً `othman` / othmanxbaroum@gmail.com).
- ألوان ANSI كاملة في الطرفيات الحقيقية (تُطفأ تلقائياً عند التوجيه إلى ملف — احترام `NO_COLOR` / `FORCE_COLOR`).
- إذا كانت خدمة الوقت الحقيقي (:3003) شغالة، تصل الإشعارات للمستخدمين لحظياً؛ وإلا تُخزَّن وتظهر عند دخولهم.

---

*MeevCMD v20 — دليل الطاقم | staff guide · ملف الطرفية: `meev-cli.ts` · المحرّك: `src/lib/meev/admin.ts` · مكتب الدعم: القسم 6*
