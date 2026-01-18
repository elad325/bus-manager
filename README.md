# 🚌 מערכת ניהול אוטובוסים

מערכת לניהול אוטובוסים, תלמידים ומסלולים עם אופטימיזציה מבוססת Google Maps.

## ✨ מה מיוחד במערכת הזו?

**💾 כל שינוי = Git commit אוטומטי!**

- ✅ **אין צורך בשרת** - עובד ישירות מהדפדפן
- ✅ **הכל ב-Git** - כל נתון נשמר במאגר GitHub
- ✅ **Commits אוטומטיים** - כל שינוי נשמר ב-Git אוטומטית
- ✅ **גיבוי מובנה** - Git היסטוריה מלאה
- ✅ **עובד מכל מקום** - רק צריך דפדפן ואינטרנט
- ✅ **גרסאות** - rollback, branches, merges

---

## 🚀 התקנה מהירה

### שלב 1: Fork את המאגר

לחץ על "Fork" למעלה בדף GitHub → יצור לך עותק של המאגר.

### שלב 2: הפעל GitHub Pages (אופציונלי)

אם אתה רוצה שהמערכת תעבוד ישירות מ-GitHub:

1. הגדרות המאגר → Pages
2. Source: Deploy from a branch
3. Branch: `main` / `(root)`
4. שמור

עכשיו תוכל לגשת ל: `https://<username>.github.io/<repo-name>`

### שלב 3: צור Personal Access Token

1. עבור ל-[GitHub Settings → Tokens](https://github.com/settings/tokens/new)
2. צור טוקן חדש עם הרשאות `repo` (Full control of private repositories)
3. העתק את הטוקן (תוכל לראות אותו רק פעם אחת!)

### שלב 4: הגדר את המערכת

1. פתח את `github-setup.html` בדפדפן (או דרך GitHub Pages)
2. הזן:
   - **Username/Organization**: שם המשתמש שלך ב-GitHub
   - **Repository Name**: שם המאגר שיצרת (בד"כ `bus-manager`)
   - **Personal Access Token**: הטוקן שיצרת
   - **Branch**: `main` (או `master` אם יש לך ענף ישן)
3. לחץ "בדוק והגדר"
4. אם הכל תקין → עבור לאפליקציה!

### שלב 5: התחל לעבוד!

פתח את `index.html` והתחל להשתמש במערכת.
**כל שינוי שתעשה יישמר אוטומטית ב-Git!** 🎉

---

## 📂 מבנה הנתונים

המערכת משתמשת ב-**3 קבצי JSON** במאגר:

| קובץ | תוכן | מתי משתנה |
|------|------|-----------|
| **users.json** | משתמשים ואימות | רישום, אישור, עדכון תפקידים |
| **data.json** | תלמידים ואוטובוסים | הוספה, עריכה, מחיקה |
| **settings.json** | API Keys והגדרות | שינוי הגדרות |

**כל שינוי בקבצים האלה = commit חדש ב-Git!**

---

## 🔄 איך זה עובד?

```
משתמש מוסיף תלמיד
    ↓
המערכת קוראת את data.json מ-GitHub
    ↓
מוסיפה את התלמיד למערך
    ↓
כותבת את data.json חזרה ל-GitHub
    ↓
✅ Git commit חדש נוצר אוטומטית!
```

**לא צריך לעשות `git add` / `git commit` / `git push` ידנית!**

---

## 🌟 תכונות

- 🔐 **מערכת אימות משתמשים** עם אישור מנהלים
- 🚌 **ניהול אוטובוסים** ומסלולים
- 👥 **ניהול תלמידים** עם גיאוקודינג
- 📊 **ייבוא מ-Excel** עם בחירת עמודות
- 🗺️ **אופטימיזציה אוטומטית** של מסלולים
- 📱 **ממשק רספונסיבי** לכל המכשירים
- 💾 **Git היסטוריה מלאה** - רואים מתי ומי שינה מה

---

## 🔑 הגדרת API Keys

### Google Maps API (חובה)

1. עבור ל-[Google Cloud Console](https://console.cloud.google.com/)
2. צור פרויקט חדש
3. הפעל APIs:
   - Maps JavaScript API
   - Geocoding API
   - Directions API
4. צור API Key ב-Credentials

5. באפליקציה:
   - עבור ל"הגדרות"
   - הזן את ה-API Key
   - שמור

**ההגדרות יישמרו ב-`settings.json` ב-Git!**

### Google Sheets API (אופציונלי)

אם אתה רוצה אינטגרציה עם Google Sheets:
1. באותו פרויקט ב-Google Cloud
2. הפעל Google Sheets API
3. צור OAuth 2.0 Client ID
4. הזן ב-הגדרות המערכת

---

## 👥 ניהול משתמשים

### משתמש ראשון = מנהל

המשתמש הראשון שנרשם הופך אוטומטית למנהל ומאושר.

### משתמשים נוספים

משתמשים נוספים צריכים אישור ממנהל לפני שיוכלו להיכנס.

**כל שינוי במשתמשים = commit ב-`users.json`!**

---

## 🔄 עבודה עם Git

### ראה היסטוריה

```bash
git log --oneline -- data.json
```

### חזור לגרסה קודמת

```bash
git checkout <commit-hash> -- data.json
git add data.json
git commit -m "Rollback data to previous version"
git push
```

### Branches

```bash
# צור ענף חדש לניסויים
git checkout -b experiment
# עשה שינויים...
# אם טוב - merge
git checkout main
git merge experiment
```

### סנכרון בין מחשבים

המערכת עובדת **ישירות מ-GitHub**, אז:
- פתח מכל מחשב → הנתונים עדכניים
- אין צורך ב-`git pull` ידני
- הכל אוטומטי!

---

## 🛠️ פיתוח

### הרצה מקומית

```bash
# פשוט פתח את index.html בדפדפן
# או השתמש בשרת HTTP פשוט:
python -m http.server 8000
# או:
npx http-server
```

### מבנה הקוד

```
bus-manager/
├── index.html              # עמוד ראשי
├── github-setup.html       # הגדרת GitHub
├── users.json             # 👥 משתמשים
├── data.json              # 🚌 נתונים
├── settings.json          # ⚙️ הגדרות
└── js/
    ├── github-storage.js  # GitHub API client
    ├── storage.js         # Storage layer
    ├── auth.js            # אימות
    ├── app.js             # לוגיקה ראשית
    ├── buses.js           # אוטובוסים
    ├── students.js        # תלמידים
    ├── routes.js          # מסלולים
    └── maps.js            # Google Maps
```

---

## 🔒 אבטחה

### Personal Access Token

- ✅ נשמר ב-localStorage של הדפדפן (לא ב-Git!)
- ✅ לא משותף עם אף אחד
- ✅ ניתן לבטל בכל עת ב-GitHub

### הרשאות מומלצות

כשיוצרים טוקן, תנו רק הרשאות `repo`:
- ✅ `repo:status` - גישה לסטטוס
- ✅ `repo_deployment` - גישה לדפלוימנטים
- ✅ `public_repo` - גישה למאגרים פומביים
- ✅ `repo` (Private) - גישה למאגרים פרטיים

**אל תתנו הרשאות מיותרות!**

---

## 💡 טיפים

### 1. עבוד בבטחה עם branches

```bash
# צור ענף לפני שינויים גדולים
git checkout -b new-feature
```

### 2. השתמש ב-Tags לגרסאות

```bash
git tag -a v1.0 -m "Version 1.0 - Stable"
git push --tags
```

### 3. גיבויים

Git הוא הגיבוי, אבל אפשר גם:
```bash
# Clone נוסף במקום אחר
git clone <your-repo-url> backup/
```

### 4. בדוק commits

בדף GitHub → "Commits" → תוכל לראות:
- מתי שונה כל קובץ
- מי שינה (אם יש כמה משתמשים)
- מה השתנה (diff)

---

## 🐛 פתרון בעיות

### "Failed to connect to GitHub"

✅ בדוק:
- הטוקן תקין?
- שם המשתמש/מאגר נכונים?
- הענף קיים?
- יש לטוקן הרשאות `repo`?

### "API rate limit exceeded"

GitHub מגביל ל-60 requests לשעה ללא אימות, 5000 עם טוקן.

אם הגעת למגבלה:
- חכה שעה
- או שדרג את הטוקן

### "Merge conflicts"

אם 2 משתמשים עורכים בו-זמנית:
1. המערכת תזהה conflict
2. תצטרך לפתור ידנית ב-GitHub
3. או להשתמש ב-Git CLI

---

## 📞 תמיכה

יש בעיה? תקלה? שאלה?

1. בדוק את ה-Console בדפדפן (F12)
2. בדוק את ה-commits ב-GitHub
3. פתח issue במאגר

---

## 📄 רישיון

MIT License - חופשי לשימוש ושינוי

---

## 🎉 סיכום

**מערכת הניהול אוטובוסים הזו:**

✅ כותבת ישירות ל-Git
✅ בלי שרת מקומי
✅ בלי תלות בענן חיצוני
✅ commits אוטומטיים
✅ היסטוריה מלאה
✅ עובדת מכל מקום

**פשוט, מהיר, ובטוח!** 🚀
