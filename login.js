// public/login/login.js

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.ok) {
      // redirect ไปหน้าที่ server.js ส่งกลับมา
      window.location.href = data.redirect;
    } else {
      alert(data.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาดกับเซิร์ฟเวอร์");
  }
});
// public/login/login.js
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    alert("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    return;
  }

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      // server.js จะส่ง { ok:true, redirect:'/shortener/index.html' }
      window.location.href = data.redirect;
    } else {
      alert(data.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
  }
});
// grist.js
const LOGIN_TABLE = 'LoginLogs'
const loginRecords = `${GRIST_BASE}/api/docs/${GRIST_DOC}/tables/${encodeURIComponent(LOGIN_TABLE)}/records`

export async function logLogin({ username, success, ip, userAgent }) {
  return gristFetch(loginRecords, {
    method: 'POST',
    body: JSON.stringify({
      records: [{
        fields: {
          Username: username,
          Success: !!success,  // <-- Toggle/Bool
          IP: ip || null,
          UserAgent: userAgent || null,
          LoginAt: new Date().toISOString()
        }
      }]
    })
  })
}
