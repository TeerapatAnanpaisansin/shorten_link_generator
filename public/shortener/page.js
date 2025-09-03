// public/shortener/page.js

// ——— Helpers ———
const $ = (sel, root = document) => root.querySelector(sel);

// POST helper
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

// ——— DOM refs ———
const form     = $("form");
const urlInput = $("#url");
const submitBtn= $("#btn");
const resultEl = $("#result");
const qrDiv    = $("#qrcode");
const dlBtn    = $("#downloadBtn");
const shortLink = $("#shortLink");
const copyBtn   = $("#copyBtn");

// ——— State ———
let qrInstance = null; // keep a single QRCode instance

function showResult(show) {
  resultEl.classList.toggle("hidden", !show)
}

// ——— UI actions ———
function showError(message) {
  resultEl.innerHTML = `<p style="color:#b00020;margin:0">${message}</p>`;
  dlBtn.disabled = true;
  showResult(true)
}

function renderQR(shortUrl) {
  // Clear old QR canvas and (re)render
  qrDiv.innerHTML = "";
  if (!qrInstance) {
    qrInstance = new QRCode(qrDiv, { width: 256, height: 256, text: shortUrl });
  } else {
    qrInstance.clear();
    qrInstance.makeCode(shortUrl);
  }
  // show the short URL under the QR
  if (shortLink) {
    shortLink.href = shortUrl;
    shortLink.textContent = shortUrl;  // visible text
  }

  // enable Copy button
  if (copyBtn) {
    copyBtn.disabled = false;
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(shortUrl);
        const old = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = old), 1200);
      } catch {
        // fallback if clipboard API blocked
        const ta = document.createElement("textarea");
        ta.value = shortUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        const old = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = old), 1200);
      }
    };
  }

  // Enable download
  dlBtn.disabled = false;
  dlBtn.onclick = () => {
    const canvas = qrDiv.querySelector("canvas");
    if (!canvas) return showError("QR not ready yet.");
    const a = document.createElement("a");
    a.download = "qrcode.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  showResult(true)
}

// ——— API ———
function shorten(url) {
  return postJSON("/api/shorten", { url });
}

// ——— Events ———
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return alert("Enter a URL");

  // lock UI
  submitBtn.disabled = true;
  dlBtn.disabled = true;
  showResult(false)

  try {
    const { shortUrl } = await shorten(url);
    renderQR(shortUrl);
  } catch (err) {
    showError(err?.message || "Something went wrong");
  } finally {
    submitBtn.disabled = false; // re-enable for next try
  }
});
