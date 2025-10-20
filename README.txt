Attendance System - Google Sheets edition
----------------------------------------

What is included:
- backend/server.js   -> Node.js server (uses Google Sheets API)
- backend/config.json -> Put your spreadsheetId here (already prefilled)
- backend/credentials.json -> PLACE your service account JSON here (NOT included)
- public/index.html   -> barcode scanning UI (works with Eyoyo & keyboard input)
- public/reports.html -> simple report pages (late / absent / staff record)
- public/style.css, public/script.js
- package.json (dependencies)

Setup steps:
1) Install Node.js (v16+ recommended) on your Windows machine.
2) Extract this ZIP to a folder, open a terminal in the project root.
3) Run: npm install
4) Create a Service Account in Google Cloud, enable Sheets API and download credentials JSON.
   Put the downloaded file at: backend/credentials.json
5) Open your Google Sheet (ID is in backend/config.json). Share the sheet with the service account email (the client_email inside credentials.json) and give Editor access.
6) Start the server: npm start
7) Open browser: http://localhost:3000  (or from other device: http://<PC_IP>:3000)

Notes:
- staff_list sheet expected columns: A:No., B:Name, C:Role/major, D:Barcode, E:Section (M/F)
- attendance_log expected columns: A:No., B:Name, C:Section, D:Date(YYYY-MM-DD), E:Time(HH:mm:ss), F:دخول/خروج, G:ملاحظات
- Credentials file not included for security. Keep it private.
- If your Google Sheet columns are different, adjust ranges in backend/server.js accordingly.
