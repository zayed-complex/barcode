// ==========================================
// 📦 إعدادات الخادم الأساسية
// ==========================================
const express = require("express");
const { google } = require("googleapis");
const path = require("path");
const cors = require("cors");
const dayjs = require("dayjs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const PORT = 5000;

// ==========================================
// 🔑 إعداد Google Sheets
// ==========================================
const SPREADSHEET_ID = "1H3Zmohxud_uQZjbKSspmlUaR7HkMmJDVzdfgcqIUIQI";
let sheetsClient = null;
let staffCache = [];

// دالة التفويض للوصول إلى Google Sheets
async function authorize() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});


  return auth.getClient();
}


// إنشاء عميل Google Sheets
async function initSheets() {
  try {
    sheetsClient = await authorize();
    console.log("✅ Google Sheets client ready");
  } catch (err) {
    console.error("❌ Failed to init Sheets client:", err);
  }
}

initSheets();

// إنشاء مثيل sheets
const sheets = google.sheets({ version: "v4" });

// ==========================================
// 🧩 دوال مساعدة للتعامل مع Google Sheets
// ==========================================

// قراءة نطاق
async function readRange(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    auth: sheetsClient,
  });
  return res.data.values || [];
}

// إضافة صف جديد
async function appendRow(sheetName, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:G`,
    valueInputOption: "USER_ENTERED",
    resource: { values: [row] },
    auth: sheetsClient,
  });
}

// تحميل بيانات الموظفين مؤقتًا في الذاكرة
async function loadStaffCache() {
  const values = await readRange("staff_list!A2:E");
  staffCache = values.map((r) => ({
    id: r[0],
    name: r[1],
    barcode: r[3],   // ← هنا التعديل، كان r[2]
    position: r[2],
    section: r[4] || "M",
  }));
  console.log(`👥 Loaded ${staffCache.length} staff records`);
}


// إيجاد موظف عبر الباركود
function findStaffByBarcode(code) {
  return staffCache.find((s) => s.barcode === code);
}

// مواعيد الدوام الافتراضية لكل قسم
const LATE = {
  M: { hh: 7, mm: 30 },
  F: { hh: 8, mm: 0 },
};

// ==========================================
// 📊 API: لوحة التحكم
// ==========================================
app.get("/api/dashboard", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [staffRes, attendanceRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "staff_list!A2:E",
        auth: sheetsClient,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "attendance_log!A2:G",
        auth: sheetsClient,
      }),
    ]);

    const staffRows = staffRes.data.values || [];
    const attendanceRows = attendanceRes.data.values || [];

    const stats = {
      M: { present: 0, absent: 0, late: 0, total: 0 },
      F: { present: 0, absent: 0, late: 0, total: 0 },
    };

    staffRows.forEach((s) => {
      const section = s[4];
      if (stats[section]) stats[section].total++;
    });

    const todayAttendance = attendanceRows.filter((r) => r[3] && r[3].startsWith(today));
    const attendedToday = new Set();

    todayAttendance.forEach((r) => {
      const section = r[2];
      const id = r[0];
      if (!stats[section]) return;
      attendedToday.add(`${section}-${id}`);
      if (r[5]?.includes("دخول")) stats[section].present++;
      if (r[6]?.includes("🕓") || r[6]?.includes("تأخر") || r[6]?.includes("تاخر"))
        stats[section].late++;
    });

    Object.keys(stats).forEach((sec) => {
      const attendedCount = Array.from(attendedToday).filter((x) =>
        x.startsWith(sec + "-")
      ).length;
      stats[sec].absent = Math.max(0, stats[sec].total - attendedCount);
    });

    res.json(stats);
  } catch (err) {
    console.error("❌ Error in /api/dashboard:", err);
    res.status(500).json({ error: "Dashboard error" });
  }
});

// ==========================================
// 📋 API: التقارير التفصيلية
// ==========================================
app.get("/api/reports", async (req, res) => {
  try {
    const { reportType = "present", section = "all", startDate, endDate } = req.query;

    const [staffRes, attendanceRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "staff_list!A2:E",
        auth: sheetsClient,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "attendance_log!A2:G",
        auth: sheetsClient,
      }),
    ]);

    const staffRows = staffRes.data.values || [];
    const attendanceRows = attendanceRes.data.values || [];

    const staffList = staffRows.map((r) => ({
      id: r[0],
      name: r[1],
      section: r[4] || "M",
    }));

    const attendance = attendanceRows.map((r) => ({
      id: r[0],
      name: r[1],
      section: r[2],
      date: r[3],
      time: r[4],
      type: r[5],
      notes: r[6] || "",
    }));

    const today = new Date();
    const start = startDate ? new Date(startDate) : new Date(today.setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();

       const filteredLogs = attendance.filter((r) => {
         const logDate = new Date(r.date);
         const inDateRange = logDate >= start && logDate <= end;
         const inSection = section === "all" || (r.section || "M").toUpperCase() === section.toUpperCase();
         return inDateRange && inSection;
       });


    const sectionFilteredStaff =
      section === "all" ? staffList : staffList.filter((s) => s.section === section);

    let final = [];

    // تقارير الحضور أو التأخر
    if (reportType === "present" || reportType === "late") {
      let relevantLogs = filteredLogs.filter((l) => l.type.includes("دخول"));
      if (reportType === "late") {
        relevantLogs = relevantLogs.filter(
          (l) => l.notes.includes("🕓") || l.notes.includes("تأخر") || l.notes.includes("تاخر")
        );
      }

      const grouped = {};
      relevantLogs.forEach((l) => {
        if (!grouped[l.id]) grouped[l.id] = { info: l, dates: [] };
        grouped[l.id].dates.push(l.date);
      });

      final = Object.values(grouped).map((g) => {
        const dates = [...new Set(g.dates)].sort();
        const displayDates = summarizeDates(dates);
        return {
          id: g.info.id,
          name: g.info.name,
          section: g.info.section,
          date: dates[dates.length - 1],
          time: g.info.time,
          type: reportType === "late" ? "تأخر" : "حضور",
          notes:
            reportType === "late"
              ? `تأخر في الأيام ${displayDates}`
              : `حضر في الأيام ${displayDates}`,
        };
      });
    }

    // تقارير الغياب
    else if (reportType === "absent") {
      const allDays = getDateRangeArray(start, end);
      const attendedBy = {};
      filteredLogs
        .filter((l) => l.type.includes("دخول"))
        .forEach((l) => {
          if (!attendedBy[l.id]) attendedBy[l.id] = new Set();
          attendedBy[l.id].add(l.date);
        });

      final = sectionFilteredStaff
        .map((s) => {
          const attendedDates = attendedBy[s.id] || new Set();
          const absentDates = allDays.filter((d) => !attendedDates.has(d));
          const displayDates = summarizeDates(absentDates);
          return {
            id: s.id,
            name: s.name,
            section: s.section,
            date: absentDates[absentDates.length - 1] || "-",
            time: "-",
            type: "غياب",
            notes:
              absentDates.length > 0
                ? `تغيب في الأيام ${displayDates}`
                : "لا يوجد غياب ضمن الفترة",
          };
        })
        .filter((r) => !r.notes.includes("لا يوجد"));
    }

    res.json({ success: true, data: final });
  } catch (err) {
    console.error("❌ Error in /api/reports:", err);
    res.status(500).json({ success: false, message: "Reports error" });
  }
});

// ==========================================
// 🧩 دوال مساعدة للتقارير
// ==========================================
function summarizeDates(dates) {
  if (dates.length === 0) return "-";
  const sorted = dates.map((d) => new Date(d)).sort((a, b) => a - b);
  const result = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const curr = sorted[i];
    const diff = curr ? (curr - prev) / (1000 * 60 * 60 * 24) : 2;
    if (diff > 1) {
      if (rangeStart.getTime() === prev.getTime()) {
        result.push(formatDate(prev));
      } else {
        result.push(`${formatDate(rangeStart)}–${formatDate(prev)}`);
      }
      rangeStart = curr;
    }
    prev = curr;
  }
  return result.join(", ");
}

function getDateRangeArray(start, end) {
  const arr = [];
  const current = new Date(start);
  while (current <= end) {
    arr.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return arr;
}

function formatDate(d) {
  const date = new Date(d);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
}

// ==========================================
// 🧩 API: مسح الباركود (دخول / خروج)
// ==========================================
app.get("/api/scan/:barcode", async (req, res) => {
  try {
    if (!sheetsClient)
      return res.status(500).json({ error: "Google Sheets not configured" });

    const code = req.params.barcode;
    const mode = req.query.mode || "دخول"; // ← الوضع القادم من الواجهة
    if (!staffCache || staffCache.length === 0) await loadStaffCache();

    const staff = findStaffByBarcode(code);
    if (!staff) return res.status(404).json({ error: "الموظف غير موجود" });

    const now = dayjs();
    const date = now.format("YYYY-MM-DD");
    const time = now.format("HH:mm:ss");

    // قراءة السجلات السابقة لهذا اليوم
    const logRows = await readRange("attendance_log!A:H");
    const dataRows = logRows.slice(1).map((r) => ({
      id: r[0] || "",
      date: r[3] || "",
      status: r[5] || "",
    }));

    const todayEntries = dataRows.filter((e) => e.id === staff.id && e.date === date);
    let last = todayEntries.length ? todayEntries[todayEntries.length - 1] : null;

    let status = mode; // ← الوضع المحدد من الواجهة هو الحالة المسجّلة
    let note = "";

    // ⚙️ منطق التأخير فقط لحالة "دخول"
    if (status === "دخول") {
      const sec = (staff.section || "M").toUpperCase();
      const thr = LATE[sec] || LATE.M;
      const cutoff = dayjs(
        `${date} ${String(thr.hh).padStart(2, "0")}:${String(thr.mm).padStart(2, "0")}:00`
      );
      if (now.isAfter(cutoff)) note = "🕓 تأخر";
    }

    // ✨ الحالات الأخرى: يمكن وضع ملاحظات خاصة
    if (status === "استئذان") note = "📋 استئذان رسمي";
    if (status === "خروج مبكر") note = "⏰ خروج قبل الوقت";

    // حفظ السجل في Google Sheets
    const row = [staff.id, staff.name, staff.section || "", date, time, status, note];
    await appendRow("attendance_log", row);

    // استجابة ناجحة للواجهة
    return res.json({ ok: true, staff, date, time, status, note });
  } catch (err) {
    console.error("❌ scan error", err);
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});


// ==========================================
// 🔐 API: تسجيل الدخول
// ==========================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "1234")
    return res.json({ success: true, role: "admin" });
  if (username === "hr" && password === "1234")
    return res.json({ success: true, role: "hr" });
  if (username === "gate" && password === "1234")
    return res.json({ success: true, role: "gate" });

  return res.json({ success: false, message: "بيانات غير صحيحة" });
});

// ==========================================
// 🏠 الصفحة الرئيسية
// ==========================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

// ==========================================
// 🚀 تشغيل الخادم
// ==========================================
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على: http://localhost:${PORT}`);
});
