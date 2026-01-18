# 🚌 מערכת ניהול אוטובוסים

מערכת לניהול אוטובוסים, תלמידים ומסלולים עם אופטימיזציה מבוססת Google Maps.

## ✨ תכונות

- 🔐 מערכת אימות משתמשים עם אישור מנהלים
- 🚌 ניהול אוטובוסים ומסלולים
- 👥 ניהול תלמידים עם גיאוקודינג
- 📊 ייבוא תלמידים מ-Excel
- 🗺️ אופטימיזציה אוטומטית של מסלולים
- 📱 ממשק רספונסיבי
- 💾 **3 מסדי נתונים JSON נפרדים ב-Git!**

## 🏗️ ארכיטקטורה

המערכת משתמשת ב-**3 קבצי JSON נפרדים** שנשמרים ב-Git:

| קובץ | תוכן | מטרה |
|------|------|------|
| 👥 **users.json** | משתמשים ואימות | ניהול משתמשים והרשאות |
| 🚌 **data.json** | תלמידים ואוטובוסים | נתוני המערכת הראשיים |
| ⚙️ **settings.json** | API Keys והגדרות | הגדרות שלא נמחקות! |

**שרת Node.js** מספק API REST פשוט לקריאה/כתיבה של הקבצים.

### למה זה טוב?
- ✅ **כל הנתונים ב-Git** - ניתן לעשות commits, rollback, branching
- ✅ **הגדרות לא נמחקות** - settings.json נפרד לגמרי
- ✅ **פשוט ובלי תלות חיצונית** - בלי Firebase או cloud
- ✅ **גיבוי אוטומטי** - Git הוא הגיבוי
- ✅ **ניהול גרסאות** - כל שינוי נשמר ב-Git history

## 🚀 התקנה והרצה

### דרישות מקדימות
- Node.js גרסה 16 ומעלה
- Git

### שלב 1: התקנת dependencies

```bash
npm install
```

### שלב 2: הרצת השרת

```bash
npm start
```

השרת יעלה על `http://localhost:3000`

### שלב 3: פתיחת הדפדפן

פתח את `http://localhost:3000` בדפדפן

---

## 📁 מבנה הפרויקט

```
bus-manager/
├── server.js                # שרת Node.js עם Express
├── package.json             # Dependencies
├── users.json              # 👥 DB למשתמשים
├── data.json               # 🚌 DB לתלמידים ואוטובוסים
├── settings.json           # ⚙️ DB להגדרות
├── index.html              # עמוד ראשי
├── js/
│   ├── config.js          # ניהול קונפיגורציה
│   ├── storage.js         # API client (fetch)
│   ├── auth.js            # אימות משתמשים
│   ├── app.js             # לוגיקה ראשית
│   ├── buses.js           # ניהול אוטובוסים
│   ├── students.js        # ניהול תלמידים
│   ├── routes.js          # ניהול מסלולים
│   ├── maps.js            # אינטגרציה עם Google Maps
│   └── sheets.js          # אינטגרציה עם Google Sheets
└── styles/
    └── main.css           # עיצוב
```

---

## 🔑 הגדרת API Keys

### Google Maps API (חובה למפות)

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com/)
2. צור פרויקט חדש או בחר קיים
3. הפעל את ה-APIs הבאים:
   - Maps JavaScript API
   - Geocoding API
   - Directions API
4. צור API Key ב-Credentials

5. **ערוך את `settings.json`:**

```json
{
  "googleMaps": {
    "apiKey": "YOUR_GOOGLE_MAPS_API_KEY_HERE"
  },
  "googleSheets": {
    "apiKey": "",
    "clientId": "",
    "spreadsheetId": ""
  }
}
```

**לחלופין**, הגדר דרך ממשק המשתמש:
- התחבר למערכת
- עבור לעמוד "הגדרות"
- הזן את ה-API Key
- לחץ "שמור"

### Google Sheets API (אופציונלי)

אם אתה רוצה אינטגרציה עם Google Sheets:

1. באותו פרויקט ב-Google Cloud
2. הפעל את Google Sheets API
3. צור OAuth 2.0 Client ID
4. העתק את Client ID ו-API Key ל-`settings.json`

---

## 👥 ניהול משתמשים

### משתמש ראשון (אדמין)

- המשתמש הראשון שנרשם הופך אוטומטית למנהל ✅
- מנהלים יכולים לאשר/לדחות משתמשים חדשים

### משתמשים נוספים

- צריכים אישור ממנהל לפני שיוכלו להיכנס ⏳
- יקבלו הודעה "החשבון ממתין לאישור"

### תיקון בעיות משתמשים

אם אתה לא יכול להתחבר, פתח את `fix-users.html` בדפדפן:
- 📊 תוכל לראות את כל המשתמשים
- ✅ לאשר משתמשים קיימים
- 🗑️ לנקות הכל ולהתחיל מחדש

---

## 🔄 עבודה עם Git

### שמירת שינויים

הנתונים נשמרים ב-3 קבצי JSON. כדי לשמור את השינויים ב-Git:

```bash
git add users.json data.json settings.json
git commit -m "עדכון נתונים - הוספת 5 תלמידים חדשים"
git push
```

### שחזור גרסה קודמת

```bash
# לראות היסטוריה
git log --oneline

# לחזור לגרסה מסוימת
git checkout <commit-hash> -- data.json

# או לבטל שינויים אחרונים
git restore data.json
```

### סנכרון בין מחשבים

```bash
# במחשב 1
git pull  # קבל שינויים אחרונים

# עשה שינויים...

git add *.json
git commit -m "עדכון נתונים"
git push

# במחשב 2
git pull  # קבל את השינויים
```

---

## 🛠️ פיתוח

### הרצה עם nodemon (reload אוטומטי)

```bash
npm run dev
```

### בדיקת תחביר

```bash
# בדיקת כל קבצי JavaScript
for file in js/*.js; do node --check "$file"; done
```

### מבנה ה-API

השרת מספק REST API:

**Users:**
- `GET /api/users` - כל המשתמשים
- `GET /api/users/:uid` - משתמש לפי UID
- `POST /api/users` - שמירת משתמש
- `PATCH /api/users/:uid/role` - עדכון תפקיד
- `PATCH /api/users/:uid/approve` - אישור משתמש
- `DELETE /api/users/:uid` - מחיקת משתמש

**Buses:**
- `GET /api/buses` - כל האוטובוסים
- `POST /api/buses` - שמירת אוטובוס
- `DELETE /api/buses/:id` - מחיקת אוטובוס

**Students:**
- `GET /api/students` - כל התלמידים
- `POST /api/students` - שמירת תלמיד
- `DELETE /api/students/:id` - מחיקת תלמיד

**Settings:**
- `GET /api/settings` - הגדרות
- `POST /api/settings` - שמירת הגדרות
- `PATCH /api/settings` - עדכון חלקי

---

## 🐛 פתרון בעיות

### "לא מצליח להתחבר"
- פתח את `fix-users.html` ואשר את המשתמשים
- בדוק שהשרת רץ (`npm start`)

### "המפות לא עובדות"
- בדוק שהגדרת Google Maps API Key ב-`settings.json`
- בדוק שהפעלת את ה-APIs הנדרשים ב-Google Cloud
- פתח Console בדפדפן (F12) וחפש שגיאות

### "השרת לא עולה"
- ודא ש-Node.js מותקן: `node --version`
- ודא שהרצת `npm install`
- בדוק שפורט 3000 לא תפוס: `lsof -i :3000` (Mac/Linux)

### "הנתונים לא נשמרים"
- בדוק שהשרת רץ
- בדוק את ה-Console בדפדפן לשגיאות
- ודא שיש הרשאות כתיבה לקבצי JSON

---

## 📄 רישיון

MIT License - חופשי לשימוש ושינוי

---

## 🙏 תודות

- Google Maps API למפות ו-geocoding
- SheetJS לייבוא Excel
- Express לשרת פשוט ומהיר

---

💡 **טיפ**: עשה backup של קבצי ה-JSON לפני עדכונים גדולים!

```bash
cp data.json data.json.backup
```
