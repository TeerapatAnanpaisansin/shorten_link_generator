// /public/login/login.js
(() => {
  const form = document.querySelector('form.form');
  const emailInput = form?.querySelector('input[name="username"]');
  const passwordInput = form?.querySelector('input[name="password"]');
  const submitBtn = form?.querySelector('button[type="submit"]');

  // ===== Helpers =====
  const $$ = (sel, root = document) => root.querySelector(sel);
  const setLoading = (loading) => {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.style.filter = loading ? 'grayscale(0.2) brightness(0.9)' : '';
    submitBtn.textContent = loading ? 'Signing in…' : 'Sign In';
  };

  const emailLike = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  const ensureMsgEl = (fieldEl) => {
    let el = fieldEl.parentElement.querySelector('.field-msg');
    if (!el) {
      el = document.createElement('div');
      el.className = 'field-msg';
      el.style.marginTop = '6px';
      el.style.fontSize = '12px';
      el.style.color = '#ffdddd';
      el.style.textAlign = 'left';
      fieldEl.parentElement.appendChild(el);
    }
    return el;
  };
  const clearMsg = (fieldEl) => {
    const el = fieldEl.parentElement.querySelector('.field-msg');
    if (el) el.textContent = '';
    fieldEl.style.borderColor = 'rgba(255,255,255,.18)';
    fieldEl.style.boxShadow = '';
  };
  const showMsg = (fieldEl, msg) => {
    const el = ensureMsgEl(fieldEl);
    el.textContent = msg || '';
    fieldEl.style.borderColor = 'rgba(255,80,80,.7)';
    fieldEl.style.boxShadow = '0 0 0 4px rgba(255,80,80,.15)';
  };

  // ===== Add "show/hide password" toggle =====
  const addPasswordToggle = () => {
    if (!passwordInput) return;
    const wrap = passwordInput.parentElement;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Toggle password visibility');
    toggle.style.position = 'absolute';
    toggle.style.right = '38px';
    toggle.style.top = '50%';
    toggle.style.transform = 'translateY(-50%)';
    toggle.style.background = 'transparent';
    toggle.style.border = 'none';
    toggle.style.cursor = 'pointer';
    toggle.style.opacity = '0.85';
    toggle.innerHTML = '<i class="fa-regular fa-eye"></i>';
    let shown = false;
    toggle.addEventListener('click', () => {
      shown = !shown;
      passwordInput.type = shown ? 'text' : 'password';
      toggle.innerHTML = shown ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
    wrap.appendChild(toggle);
  };

  // ===== Add "Remember me" (remember email only) =====
  const addRemember = () => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.fontSize = '13px';
    row.style.color = '#C8CBD3';
    row.style.margin = '-2px 0 4px';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.accentColor = '#2FB3AC';

    row.appendChild(cb);
    row.appendChild(document.createTextNode('Remember email'));

    form.insertBefore(row, form.lastElementChild); // วางก่อนปุ่ม

    // load
    const saved = localStorage.getItem('login_email');
    if (saved && emailInput) {
      emailInput.value = saved;
      cb.checked = true;
    }
    // save
    cb.addEventListener('change', () => {
      if (!emailInput) return;
      if (cb.checked) localStorage.setItem('login_email', emailInput.value.trim());
      else localStorage.removeItem('login_email');
    });
    emailInput?.addEventListener('input', () => {
      if (cb.checked) localStorage.setItem('login_email', emailInput.value.trim());
    });
  };

  // ===== Top-level error toast =====
  const ensureToast = () => {
    let t = $$('.login-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'login-toast';
      t.style.position = 'fixed';
      t.style.left = '50%';
      t.style.top = '24px';
      t.style.transform = 'translateX(-50%)';
      t.style.padding = '10px 14px';
      t.style.borderRadius = '12px';
      t.style.background = 'rgba(255,60,60,.90)';
      t.style.color = '#fff';
      t.style.boxShadow = '0 8px 24px rgba(0,0,0,.25)';
      t.style.fontSize = '13px';
      t.style.letterSpacing = '.2px';
      t.style.display = 'none';
      t.style.zIndex = '9999';
      document.body.appendChild(t);
    }
    return t;
  };
  const showToast = (msg) => {
    const t = ensureToast();
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.style.display = 'none'), 2600);
  };

  // ===== Client-side validation =====
  const validate = () => {
    let ok = true;
    if (emailInput) {
      clearMsg(emailInput);
      if (!emailLike(emailInput.value)) {
        showMsg(emailInput, 'กรุณากรอกอีเมลให้ถูกต้อง');
        ok = false;
      }
    }
    if (passwordInput) {
      clearMsg(passwordInput);
      if (!String(passwordInput.value).trim()) {
        showMsg(passwordInput, 'กรุณากรอกรหัสผ่าน');
        ok = false;
      }
    }
    return ok;
  };

  // ===== Submit (AJAX) =====
  form?.addEventListener('submit', async (e) => {
    // Progressive enhancement: ใช้ AJAX ถ้าได้; ถ้าไม่ได้จะตกไปใช้ form post ปกติ
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);

      const payload = {
        username: emailInput.value.trim(),
        password: passwordInput.value,
      };

      const res = await fetch(form.action || '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      // รองรับได้หลายรูปแบบ response:
      if (res.ok) {
        // 1) ถ้า backend ส่ง JSON เช่น {redirect:'/dashboard'} หรือ {ok:true}
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json().catch(() => ({}));
          if (data.redirect) {
            window.location.href = data.redirect;
            return;
          }
          // เผื่อไม่ได้ส่ง redirect: ถ้า ok ให้เด้งหน้า root/dashboard
          if (data.ok !== false) {
            window.location.href = '/';
            return;
          }
        }
        // 2) ถ้า backend ส่ง HTML (เช่น redirect ผ่าน server)
        // ให้บังคับเปลี่ยนหน้าเดิม (follow redirect)
        window.location.href = res.url || '/';
        return;
      }

      // error message จาก backend (เช่น {message:"Invalid credentials"})
      let msg = 'เข้าสู่ระบบไม่สำเร็จ';
      try {
        const data = await res.json();
        if (data?.message) msg = data.message;
      } catch (_) {
        // ignore
      }
      showToast(msg);
      passwordInput?.focus();
      passwordInput?.select();
    } catch (err) {
      console.error('Login error:', err);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  });

  // Clear error when typing
  emailInput?.addEventListener('input', () => clearMsg(emailInput));
  passwordInput?.addEventListener('input', () => clearMsg(passwordInput));

  // UX tweaks
  addPasswordToggle();
  addRemember();

  // Enter key on inputs already triggers submit; no extra handler needed
})();
