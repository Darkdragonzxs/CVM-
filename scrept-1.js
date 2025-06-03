import Hyperbeam from "https://unpkg.com/@hyperbeam/web@latest/dist/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1) GLOBAL FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Warn user before leaving the page
function blockUnload(e) {
  e.preventDefault();
  e.returnValue = "";
}

// Check if user has premium flag in localStorage
function isUserPremium() {
  const token = localStorage.getItem("cvm_token");
  if (!token) return false;
  return localStorage.getItem("cvm_premium") === "1";
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) MAIN APP SETUP
// ─────────────────────────────────────────────────────────────────────────────
function initApp() {
  // ======== Apply premium theme ========
  if (isUserPremium()) {
    document.documentElement.classList.add("premium-theme");
  } else {
    document.documentElement.classList.remove("premium-theme");
  }

  // ======== Replace content if user is premium ========
  if (isUserPremium()) {
    const warningH2 = document.querySelector('#warning h2');
    if (warningH2) {
      warningH2.textContent = "Thanks for buying premium and using CVM!";
    }
    const paras = document.querySelectorAll('#warning .overlay-content p');
    if (paras[1]) {
      paras[1].textContent =
        "With premium, you got a special theme, 40 minutes of time, AND are the first priority to fixing, CVM is also updated frequently, so you will get early updates too!";
    }
    if (paras[2]) {
      paras[2].innerHTML =
        `If you are enjoying premium, consider subscribing to my <a href="https://www.youtube.com/@wilburzenith" target="_blank" rel="noopener noreferrer" style="color:#55C629; text-decoration:underline;">YouTube</a> channel!`;
    }
    document.querySelectorAll('#warning .overlay-content i').forEach(elem => {
      const txt = elem.textContent.trim();
      if (txt === "What is premium?") {
        elem.textContent = " ";
      } else if (txt === "Why is there a time limit?") {
        elem.textContent = " ";
      }
    });
    const serverSwitch = document.getElementById('server-switch');
    if (serverSwitch) {
      serverSwitch.innerHTML = `
        <button data-url="https://api-main.cvm.rest/" class="selected">Main 🟢</button>
        <button data-url="https://api-1.cvm.rest/">1 🟢</button>
      `;
    }
    // Personalized greeting
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const username = localStorage.getItem("cvm_username") || "User";
    const greetingText = `Good ${timeOfDay}, ${username}`;

    const h2 = document.querySelector("#warning .overlay-content > h2");
    if (h2) {
      const greeting = document.createElement("p");
      greeting.textContent = greetingText;
      greeting.style.fontSize = "30px";
      greeting.style.fontWeight = "bold";
      greeting.style.marginTop = "8px";
      h2.insertAdjacentElement("afterend", greeting);
    }
  }

  // ======== Grab selected server URL ========
  let serverUrl = document.querySelector('#server-switch button.selected').dataset.url;
  document.querySelectorAll('#server-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#server-switch button')
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      serverUrl = btn.dataset.url;
    });
  });

  // ======== Fullscreen toggle ========
  const fsWrapper = document.getElementById('fullscreen-timer-wrapper');
  const fsTimer = document.getElementById('fullscreen-timer');
  const toggleBtn = document.getElementById('toggle-timer-btn');
  toggleBtn.addEventListener('click', () => {
    const hidden = fsTimer.style.display === 'none';
    fsTimer.style.display = hidden ? 'inline' : 'none';
    toggleBtn.textContent = hidden ? '<' : '>';
  });

  // ======== Main start() — initialize Hyperbeam ========
 async function start() {
  // Show the “black screen?” overlay after 5 seconds
  setTimeout(() => document.getElementById('black-notif').classList.add('active'), 5000);

  try {
    // 1) Retrieve username and token from localStorage
    const username  = localStorage.getItem("cvm_username") || "guest";
    const authToken = localStorage.getItem("cvm_token")    || "";

    // 2) POST to your Worker with payload
    const res = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        token:    authToken
      })
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }

    // 3) Parse and validate embed_url
    const data = await res.json();
    console.log("Server response data:", data);
    if (
      !data.embed_url ||
      typeof data.embed_url !== "string" ||
      !data.embed_url.startsWith("http")
    ) {
      throw new Error("Invalid embed_url received from server");
    }

    // 4) Clear any previous error message
    const errorElement = document.getElementById("error-message");
    if (errorElement) {
      errorElement.style.display = "none";
      errorElement.textContent = "";
    }

    // 5) Initialize Hyperbeam
    await Hyperbeam(
      document.getElementById("hyperbeam-container"),
      data.embed_url,
      { iframeAttributes: { allow: "fullscreen" } }
    );

  } catch (err) {
    console.error("Failed to start CVM:", err);
    const errorElement = document.getElementById("error-message");
    if (errorElement) {
      errorElement.style.display = "block";
      errorElement.textContent =
        "Unable to launch CVM. Possible proxy issue, rate-limit, or network block.";
    }
  }
}
  // ======== Overlay & timer wiring ========
  let minuteAlertShown = false,
      timeoutExpired = false;

  document.getElementById('acknowledge-checkbox').addEventListener('change', e =>
    document.getElementById('close-warning').disabled = !e.target.checked
  );
  document.getElementById('close-warning').addEventListener('click', () => {
    document.getElementById('warning').classList.remove('active');
    start();
    startTimer();
  });
  document.getElementById('minute-ok').addEventListener('click', () =>
    document.getElementById('minute-warning').classList.remove('active')
  );
  document.getElementById('notif-no').addEventListener('click', () =>
    document.getElementById('black-notif').classList.remove('active')
  );
  document.getElementById('notif-yes').addEventListener('click', () => {
    document.getElementById('black-notif').classList.remove('active');
    document.getElementById('black-alert').classList.add('active');
  });
  document.getElementById('black-ok').addEventListener('click', () =>
    document.getElementById('black-alert').classList.remove('active')
  );
  document.getElementById('fullscreen-btn').addEventListener('click', async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const inFS = !!document.fullscreenElement;
    document.getElementById('bottom-bar').style.display = inFS ? 'none' : 'flex';
    document.getElementById('hyperbeam-container')
      .classList.toggle('fullscreen-mode', inFS);
    fsWrapper.style.display = inFS ? 'flex' : 'none';
    if (inFS) {
      fsTimer.style.display = 'inline';
      toggleBtn.textContent = '<';
    }
  });

  // ======== Timer logic ========
  function startTimer() {
    let t = isUserPremium() ? 40 * 60 : 20 * 60;
    updateTimerDisplay(t);
    const iv = setInterval(() => {
      if (t > 0) {
        t--;
        updateTimerDisplay(t);
        if (t === 60 && !minuteAlertShown) {
          minuteAlertShown = true;
          document.getElementById('minute-warning').classList.add('active');
        }
      } else {
        clearInterval(iv);
        timeoutExpired = true;
        window.removeEventListener('beforeunload', blockUnload);
        window.location.href = 'https://cvm.rest/';
      }
    }, 1000);
  }

  function updateTimerDisplay(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const txt = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    document.getElementById('timer').textContent = txt;
    document.getElementById('fullscreen-timer').textContent = txt;
  }
} // ─── end of initApp()

// ─────────────────────────────────────────────────────────────────────────────
// 3) HOOKING UP AUTH FLOW
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("overlay");
  const guestBtn = document.getElementById("auth-guest");
  const submit   = document.getElementById("auth-submit");
  const toggle   = document.getElementById("auth-toggle");
  const titleEl  = document.getElementById("auth-title");
  const userEl   = document.getElementById("auth-username");
  const passEl   = document.getElementById("auth-password");
  const errorEl  = document.getElementById("auth-error");
  const WORKER_BASE = "https://account.cvm.rest";

  let isSignup = false;
  let started  = false;

  function finishAuth() {
    overlay.style.display = "none";
    if (!started) {
      started = true;
      initApp();
      window.addEventListener('beforeunload', blockUnload);
    }
  }

  // Auto-login if token exists
  if (localStorage.getItem("cvm_token")) {
    finishAuth();
  }

  // Guest access
  guestBtn.addEventListener("click", finishAuth);

  // Toggle login/signup UI
  toggle.addEventListener("click", () => {
    isSignup = !isSignup;
    titleEl.textContent = isSignup ? "Sign Up" : "Login";
    submit.textContent   = isSignup ? "Sign Up" : "Login";
    toggle.textContent   = isSignup
      ? "Already have an account? Login"
      : "Don't have an account? Sign up";
    errorEl.textContent = "";
  });

  // Login / Sign Up flow
  submit.addEventListener("click", async () => {
    const username = userEl.value.trim();
    const password = passEl.value;
    if (!username || !password) {
      errorEl.textContent = "Please fill in both fields.";
      return;
    }
    const endpoint = isSignup ? "/signup" : "/login";
    try {
      const res = await fetch(WORKER_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      localStorage.setItem("cvm_token", data.token);
      localStorage.setItem("cvm_username", username);
      localStorage.setItem("cvm_premium", data.premium ? "1" : "0");
      finishAuth();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
});
