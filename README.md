# 🚌 מערכת ניהול אוטובוסים

מערכת לניהול אוטובוסים, תלמידים ומסלולים עם אופטימיזציה מבוססת Google Maps.

## ✨ תכונות

- 🔐 מערכת אימות משתמשים עם אישור מנהלים
- 🚌 ניהול אוטובוסים ומסלולים
- 👥 ניהול תלמידים עם גיאוקודינג
- 📊 ייבוא תלמידים מ-Excel
- 🗺️ אופטימיזציה אוטומטית של מסלולים
- 📱 ממשק רספונסיבי
- ☁️ תמיכה ב-Firebase או מצב מקומי

## 🔧 התקנה והגדרה

### 1. הגדרת API Keys (אופציונלי אבל מומלץ)

המערכת תומכת ב**3 מסדי נתונים נפרדים** להפרדה מלאה:
- 👥 **Users DB** - משתמשים ואימות
- 🚌 **Data DB** - תלמידים ואוטובוסים
- ⚙️ **Settings DB** - הגדרות API

#### **אפשרות א': קובץ קונפיגורציה מקומי** (מומלץ - לא יימחק!)

1. העתק את קובץ הדוגמה:
   ```bash
   cp config.local.js.example config.local.js
   ```

2. ערוך את `config.local.js` והכנס את המפתחות שלך:
   ```javascript
   window.LOCAL_CONFIG = {
       // 👥 Firebase למשתמשים (Users DB)
       firebaseUsers: {
           apiKey: "YOUR_FIREBASE_API_KEY",
           authDomain: "YOUR_USERS_PROJECT.firebaseapp.com",
           projectId: "YOUR_USERS_PROJECT_ID",
           // ...
       },

       // 🚌 Firebase לתלמידים ואוטובוסים (Data DB)
       firebaseData: {
           apiKey: "YOUR_FIREBASE_API_KEY",
           authDomain: "YOUR_DATA_PROJECT.firebaseapp.com",
           projectId: "YOUR_DATA_PROJECT_ID",
           // ...
       },

       // ⚙️ Firebase להגדרות (Settings DB)
       firebaseSettings: {
           apiKey: "YOUR_FIREBASE_API_KEY",
           authDomain: "YOUR_SETTINGS_PROJECT.firebaseapp.com",
           projectId: "YOUR_SETTINGS_PROJECT_ID",
           // ...
       },

       googleMaps: {
           apiKey: "YOUR_GOOGLE_MAPS_API_KEY"
       },
       googleSheets: {
           apiKey: "YOUR_GOOGLE_SHEETS_API_KEY",
           clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",
           spreadsheetId: "YOUR_SPREADSHEET_ID"
       }
   };
   ```

3. **הקובץ לא יועלה ל-Git** - ההגדרות שלך יישארו במחשב! 🔒

**💡 טיפ**: אם אתה רוצה להשתמש באותו Firebase Project לכל 3 ה-DBs, פשוט העתק את אותם פרטי Firebase לשלושת הקונפיגורציות!

#### **אפשרות ב': דרך ממשק ההגדרות**

1. פתח את האפליקציה
2. עבור לעמוד ההגדרות
3. הזן את ה-API Keys
4. ההגדרות יישמרו ב-localStorage ו-Firestore (אם מוגדר)

### 2. סדרי עדיפויות בטעינת הגדרות

המערכת טוענת הגדרות לפי הסדר הבא:

1. 📁 **config.local.js** (קובץ מקומי - עדיפות ראשונה)
   - 👥 `firebaseUsers` → Users DB
   - 🚌 `firebaseData` → Data DB
   - ⚙️ `firebaseSettings` → Settings DB
2. ☁️ **Firestore** (כל DB נפרד - אם Firebase מוגדר)
3. 💾 **localStorage** (גיבוי מקומי)

זה אומר שאם יש לך `config.local.js`, המערכת תשתמש בו תמיד, ולא תשנה אותו!

### 3. מבנה מסדי הנתונים

המערכת משתמשת ב-3 Firebase databases נפרדים:

| DB | מה נמצא בו | יתרונות |
|----|-----------|---------|
| 👥 **Users DB** | משתמשים, אימות, הרשאות | אבטחה, הפרדת גישות |
| 🚌 **Data DB** | תלמידים, אוטובוסים, מסלולים | ביצועים, ניהול נפרד |
| ⚙️ **Settings DB** | API Keys, הגדרות מערכת | לא נמחק, נפרד מנתונים |

**למה זה חשוב?**
- ✅ הגדרות לא נמחקות בטעות
- ✅ אפשר לתת גישות שונות לכל DB
- ✅ גיבוי נפרד לכל סוג נתונים
- ✅ ביצועים טובים יותר

### 4. הרצת האפליקציה

#### **מצב פיתוח (מומלץ):**
```bash
# עם Python 3
python -m http.server 8000

# או עם Node.js
npx http-server -p 8000
```

פתח בדפדפן: `http://localhost:8000`

#### **מצב מקומי:**
פשוט פתח את `index.html` בדפדפן (חלק מהתכונות עשויות להיות מוגבלות)

## 👥 ניהול משתמשים

### משתמש ראשון (אדמין)

- המשתמש הראשון שנרשם הופך אוטומטית למנהל
- מנהלים יכולים לאשר/לדחות משתמשים חדשים

### משתמשים נוספים

- צריכים אישור ממנהל לפני שיוכלו להיכנס
- יקבלו הודעה "החשבון ממתין לאישור"

### תיקון בעיות משתמשים

אם אתה לא יכול להתחבר, פתח את `fix-users.html` ב דפדפן:
- 📊 תוכל לראות את כל המשתמשים
- ✅ לאשר משתמשים קיימים
- 🗑️ לנקות הכל ולהתחיל מחדש

## 📚 מבנה הפרויקט

```
bus-manager/
├── index.html              # עמוד ראשי
├── config.local.js         # הגדרות מקומיות (לא ב-git) 🔒
├── config.local.js.example # דוגמה להגדרות
├── fix-users.html          # כלי תיקון משתמשים
├── js/
│   ├── config.js           # ניהול קונפיגורציה
│   ├── storage.js          # ניהול אחסון (Firestore/localStorage)
│   ├── auth.js             # אימות משתמשים
│   ├── app.js              # לוגיקה ראשית
│   ├── buses.js            # ניהול אוטובוסים
│   ├── students.js         # ניהול תלמידים
│   ├── routes.js           # ניהול מסלולים
│   ├── maps.js             # אינטגרציה עם Google Maps
│   └── sheets.js           # אינטגרציה עם Google Sheets
└── styles/
    └── main.css            # עיצוב
```

## 🔑 קבלת API Keys

### Firebase (אופציונלי)
1. היכנס ל-[Firebase Console](https://console.firebase.google.com/)
2. צור פרויקט חדש
3. הוסף אפליקציית Web
4. העתק את פרטי ההגדרה

### Google Maps API
1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com/)
2. צור פרויקט חדש או בחר קיים
3. הפעל את ה-APIs הבאים:
   - Maps JavaScript API
   - Geocoding API
   - Directions API
4. צור API Key ב-Credentials

### Google Sheets API (אופציונלי)
1. באותו פרויקט ב-Google Cloud
2. הפעל את Google Sheets API
3. צור OAuth 2.0 Client ID
4. העתק את Client ID ו-API Key

## 🛡️ אבטחה

- ✅ XSS Protection - כל קלט משתמש מנוטרל
- ✅ קבצי הגדרות לא מועלים ל-Git
- ✅ מערכת אישור משתמשים
- ✅ הפרדה בין הגדרות לנתונים

## 🐛 פתרון בעיות

### "לא מצליח להתחבר"
- פתח את `fix-users.html` ואשר את המשתמשים
- בדוק שה-API Keys נכונים

### "המפות לא עובדות"
- בדוק שהגדרת Google Maps API Key
- בדוק שהפעלת את ה-APIs הנדרשים ב-Google Cloud

### "הנתונים נמחקים"
- השתמש ב-`config.local.js` במקום להזין הגדרות בממשק
- בדוק שלא מחקת את localStorage

### "שגיאות תחביר בדפדפן"
- בדוק את ה-Console בדפדפן
- ודא שכל קבצי ה-JS נטענים כראוי

## 📞 תמיכה

אם נתקלת בבעיה, בדוק:
1. 🔍 Console בדפדפן (F12) - שגיאות
2. 📁 הקובץ `config.local.js` קיים ותקין
3. 🔑 ה-API Keys תקינים ופעילים
4. 🌐 יש חיבור לאינטרנט (אם משתמש ב-Firebase/Google APIs)

## 📄 רישיון

MIT License - חופשי לשימוש ושינוי

---

💡 **טיפ**: שמור את הקובץ `config.local.js` בגיבוי נפרד כדי שלא תאבד את ההגדרות!
