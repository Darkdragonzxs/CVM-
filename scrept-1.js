import Hyperbeam from "https://unpkg.com/@hyperbeam/web@latest/dist/index.js";

////////////////////////////////////////////////////////////////////////////////
// 1) GLOBAL FUNCTIONS
////////////////////////////////////////////////////////////////////////////////

// Warn user before leaving the page
function blockUnload(e) {
  e.preventDefault();
  e.returnValue = "";
}

// Check if user is premium
function isUserPremium() {
  const token = localStorage.getItem("cvm_token");
  if (!token) return false;
  return localStorage.getItem("cvm_premium") === "1";
}

////////////////////////////////////////////////////////////////////////////////
// 2) MAIN APP SETUP
////////////////////////////////////////////////////////////////////////////////
function initApp() {
  // ======== 2.1 Apply premium theme ========
  if (isUserPremium()) {
    document.documentElement.classList.add("premium-theme");
  } else {
    document.documentElement.classList.remove("premium-theme");
  }

  // ======== 2.2 Replace content if user is premium ========
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
        <button data-url="https://api-main.cvm.rest" class="selected">Main 🟢</button>
        <button data-url="https://api-1.cvm.rest">1 🟢</button>
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

  // ======== 2.3 Grab selected serverUrl & wire up buttons ========
  let serverUrl = document.querySelector('#server-switch button.selected').dataset.url;
  document.querySelectorAll('#server-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#server-switch button')
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      serverUrl = btn.dataset.url;

      // The duplicate event listener removed; corrected as follows:
      console.log('[DEBUG] server-switch clicked:', btn.textContent, '→ new URL:', btn.dataset.url);
    });
  });

  // ======== 2.4 Fullscreen toggle logic (unchanged) ========
  const fsWrapper = document.getElementById('fullscreen-timer-wrapper');
  const fsTimer = document.getElementById('fullscreen-timer');
  const toggleBtn = document.getElementById('toggle-timer-btn');
  toggleBtn.addEventListener('click', () => {
    const hidden = fsTimer.style.display === 'none';
    fsTimer.style.display = hidden ? 'inline' : 'none';
    toggleBtn.textContent = hidden ? '<' : '>';
  });

  // ======== 2.5 Start the VM via SDK ========
  async function start() {
    // Show black-screen notification after 5 seconds
    setTimeout(() => document.getElementById('black-notif').classList.add('active'), 5000);

    try {
      // 2.5.1 Retrieve username and token
      const username  = localStorage.getItem("cvm_username") || "guest";
      const authToken = localStorage.getItem("cvm_token")    || "";

      // 2.5.2 POST to your Worker (you get back sessionId + embed_url)
      const res = await fetch(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, token: authToken })
      });
      if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      console.log("Server response data:", data);

      // 2.5.3 Validate embed_url
      if (
        !data.embed_url ||
        typeof data.embed_url !== "string" ||
        !data.embed_url.startsWith("http")
      ) {
        throw new Error("Invalid embed_url received from server");
      }

      // 2.5.4 Build the proxy URL using serverUrl & sessionId
      const query = new URL(data.embed_url).search;       // e.g. "?token=XXXX&no_cbor=1"
      const sessionId = data.sessionId;                   // e.g. "mbfsgffibk8nw0"
      const proxyUrl = `${serverUrl}/vm/${sessionId}${query}`;

      // 2.5.5 Clear any previous error message before loading SDK
      const errorElement = document.getElementById("error-message");
      if (errorElement) {
        errorElement.style.display = "none";
        errorElement.textContent = "";
      }

      // 2.5.6 Initialize the Hyperbeam SDK with the proxied URL
      const hyperbeamInstance = await Hyperbeam(
        document.getElementById("hyperbeam-container"),
        proxyUrl,
        {
          iframeAttributes: {
            allow: "fullscreen; microphone; camera; autoplay"
          }
        }
      );

      // ── DEBUG: Listen for connection‐state changes ──────────────────────────────
      hyperbeamInstance.on("connectionState", (state) => {
        console.log("[Hyperbeam] connectionState →", state);
      });

      // ── DEBUG: Listen for any error events ─────────────────────────────────────
      hyperbeamInstance.on("error", (err) => {
        console.error("[Hyperbeam] error event →", err);
      });

      // ── DEBUG: Listen for disconnect reasons ───────────────────────────────────
      hyperbeamInstance.on("disconnect", (reason) => {
        console.warn("[Hyperbeam] disconnected →", reason);
      });

      console.log("SDK instance loaded:", hyperbeamInstance);
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

  // ======== 2.6 Overlay & timer wiring (unchanged) ========
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

  // ======== 2.7 Timer logic (unchanged) ========
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

////////////////////////////////////////////////////////////////////////////////
// 3) HOOKING UP AUTH FLOW
////////////////////////////////////////////////////////////////////////////////
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

  // Toggle login/signup mode
  toggle.addEventListener("click", () => {
    isSignup = !isSignup;
    titleEl.textContent = isSignup ? "Sign Up" : "Log In";
    toggle.textContent = isSignup ? "Already have an account? Log in" : "Don't have an account? Sign up";
    passEl.style.display = isSignup ? "block" : "none";
    errorEl.textContent = "";
  });

  // Handle login/signup form submit
  submit.addEventListener("click", async () => {
    errorEl.textContent = "";
    const username = userEl.value.trim();
    const password = passEl.value;
    if (!username || (isSignup && !password)) {
      errorEl.textContent = "Please fill out all required fields.";
      return;
    }

    const endpoint = isSignup ? "/signup" : "/login";
    try {
      const res = await fetch(WORKER_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to authenticate");
      }
      const data = await res.json();

      localStorage.setItem("cvm_token", data.token);
      localStorage.setItem("cvm_username", username);
      localStorage.setItem("cvm_premium", data.premium ? "1" : "0");

      finishAuth();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
});
