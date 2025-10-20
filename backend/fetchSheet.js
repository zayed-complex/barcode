import fetch from "node-fetch";

/**
 * دالة لجلب بيانات ورقة معينة من Google Sheets باستخدام واجهة GViz
 * @param {string} sheetName اسم الورقة المطلوب جلبها (مثلاً "staff_list" أو "attendance_log")
 */
export default async function fetchSheet(sheetName) {
  const SHEET_ID = "1H3Zmohxud_uQZjbKSspmlUaR7HkMmJDVzdfgcqIUIQI"; // ✅ معرّف الملف من Google Sheets
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    // إزالة التغليف غير القياسي من JSON
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows.map((r) =>
      r.c.map((c) => (c ? c.v ?? "" : ""))
    );

    return rows;
  } catch (err) {
    console.error(`❌ fetchSheet(${sheetName}) failed:`, err);
    throw new Error(`تعذر جلب البيانات من Google Sheet (${sheetName})`);
  }
}
