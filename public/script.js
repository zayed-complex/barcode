console.log("✅ App script loaded");

// ✅ تسجيل الـ Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => console.log("🟢 Service Worker Registered"))
    .catch(err => console.error("❌ فشل تسجيل Service Worker:", err));
}

// ✅ اكتشاف وضع التطبيق (PWA)
if (window.matchMedia("(display-mode: standalone)").matches) {
  console.log("📱 التطبيق يعمل كـ PWA");
}

// ✅ دالة تسجيل الدخول (بدون تغيير في المنطق)
async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("msg");

  if (!username || !password) {
    showMsg("يرجى إدخال اسم المستخدم وكلمة المرور", true);
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.success) {
      showMsg("✅ تم تسجيل الدخول بنجاح", false);
      setTimeout(() => {
        switch (data.role) {
          case "admin":
            location.href = "dashboard.html";
            break;
          case "hr":
            location.href = "reports.html";
            break;
          case "gate":
            location.href = "gate.html";
            break;
          default:
            showMsg("⚠️ لم يتم تحديد صلاحية المستخدم", true);
        }
      }, 700);
    } else {
      showMsg("بيانات غير صحيحة، حاول مرة أخرى", true);
    }
  } catch (e) {
    console.error(e);
    showMsg("⚠️ تعذر الاتصال بالخادم", true);
  }
}

function showMsg(text, isError = false) {
  const msg = document.getElementById("msg");
  msg.textContent = text;
  msg.className = "msg " + (isError ? "error" : "success");
  msg.style.display = "block";
}

document.getElementById("loginBtn").onclick = login;
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
