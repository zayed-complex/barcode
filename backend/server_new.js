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

// ==========================================
// 🔑 إعداد Google Sheets
// ==========================================
const SPREADSHEET_ID = "1GIOkPpqOy3pqyHPJ5huwR8ReOdscR-aphuUpA596qx4";
let sheetsClient = null;
let staffCache = [];

// دالة التفويض للوصول إلى Google Sheets
async function authorize() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    sheetsClient = await auth.getClient();
    console.log("✅ Google Sheets client ready");
  } catch (err) {
    console.error("❌ Failed to init Sheets client:", err);
  }
}

authorize();

// ==========================================
// 🧩 دوال مساعدة للتعامل مع Google Sheets
// ==========================================
const sheets = google.sheets({ version: "v4" });

// قراءة نطاق
async function readRange(range) {
  if (!sheetsClient) throw new Error("Sheets client not initialized");
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
    barcode: r[3],  // تأكد من أن العمود 4 يحتوي على الباركود
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
// 🧩 API: مسح الباركود (دخول / خروج)
// ==========================================
app.get("/api/scan/:barcode", async (req, res) => {
  try {
    if (!sheetsClient)
      return res.status(500).json({ error: "Google Sheets not configured" });

    const code = req.params.barcode;
    if (!staffCache || staffCache.length === 0) await loadStaffCache();

    const staff = findStaffByBarcode(code);
    if (!staff) return res.status(404).json({ error: "Employee not found" });

    // ✅ استخدم توقيت الإمارات (GMT+4)
    const now = dayjs().add(4, "hour");
    const date = now.format("YYYY-MM-DD");
    const time = now.format("HH:mm:ss");

    const logRows = await readRange("attendance_log!A:G");
    const dataRows = logRows.slice(1).map((r) => ({
      id: r[0] || "",
      date: r[3] || "",
      status: r[5] || "",
    }));

    const todayEntries = dataRows.filter((e) => e.id === staff.id && e.date === date);
    let last = todayEntries.length ? todayEntries[todayEntries.length - 1] : null;

    let status = "دخول";
    if (last && last.status === "دخول") status = "خروج";

    let note = "";
    if (status === "دخول") {
      const sec = (staff.section || "M").toUpperCase();
      const thr = LATE[sec] || LATE.M;
      const cutoff = dayjs(`${date} ${String(thr.hh).padStart(2,"0")}:${String(thr.mm).padStart(2,"0")}:00`);
      if (now.isAfter(cutoff)) note = "🕓 تأخر";
    }

    const row = [staff.id, staff.name, staff.section || "", date, time, status, note];
    await appendRow("attendance_log", row);
    return res.json({ ok: true, staff, date, time, status, note });
  } catch (err) {
    console.error("scan error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ==========================================
// 🔐 API: تسجيل الدخول
// ==========================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "1234") return res.json({ success: true, role: "admin" });
  if (username === "hr" && password === "1234") return res.json({ success: true, role: "hr" });
  if (username === "gate" && password === "1234") return res.json({ success: true, role: "gate" });
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
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ الخادم يعمل على المنفذ: ${PORT}`);
});
