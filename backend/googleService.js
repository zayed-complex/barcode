import { google } from "googleapis";
import fs from "fs";
import path from "path";

const __dirname = path.resolve();
const creds = JSON.parse(fs.readFileSync(path.join(__dirname, "backend/credentials.json")));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "backend/config.json")));

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
const sheets = google.sheets({ version: "v4", auth });

export async function loadStaffList() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId, // ✅ تم التصحيح هنا
    range: "staff_list!A2:F", // ✅ تمت إضافة العمود F إذا احتجته لاحقًا
  });

  return res.data.values.map(r => ({
    No: r[0],
    Name: r[1],
    Role: r[2],
    Barcode: r[3],
    Section: r[4],
  }));
}

export async function saveAttendance(staff, type, note = "") {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" });

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: "attendance_log!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[staff.No, staff.Name, staff.Section, date, time, type, note]],
    },
  });
}

