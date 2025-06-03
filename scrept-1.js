import Hyperbeam from "https://unpkg.com/@hyperbeam/web@latest/dist/index.js";

////////////////////////////////////////////////////////////////////////////////
// 1) GLOBAL FUNCTIONS
////////////////////////////////////////////////////////////////////////////////
function blockUnload(e) {
  e.preventDefault();
  e.returnValue = "";
}

function isUserPremium() {
  const token = localStorage.getItem("cvm_token");
  if (!token) return false;
  return localStorage.getItem("cvm_premium") === "1";
}

////////////////////////////////////////////////////////////////////////////////
// 2) MAIN APP SETUP
////////////////////////////////////////////////////////////////////////////////
function initApp() {
  // … (apply themes, premium UI tweaks, etc.) …

  // ======== 2.3 Wire up the server-switch buttons ========
  // Your HTML already has multiple <button data-url="https://api-?.cvm.rest">…</button>
  let serverUrl = document.querySelector('#server-switch button.selected').dataset.url;
  const serverButtons = document.querySelectorAll('#server-switch button');
  serverButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // 1) Remove 'selected' from all, add to clicked
      serverButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // 2) Update `serverUrl`
      serverUrl = btn.dataset.url;
      console.log("[DEBUG] server-switch clicked → new URL:", serverUrl);
    });
  });

  // ======== 2.5 Start the VM via Hyperbeam SDK ========
  async function start() {
    // show black-space overlay after 5s (unchanged)
    setTimeout(() => {
      const blackNotif = document.getElementById('black-notif');
      if (blackNotif) blackNotif.classList.add('active');
    }, 5000);

    try {
      // 2.5.1 Gather any payload you need (username, authToken, etc.)
      const username  = localStorage.getItem("cvm_username") || "guest";
      const authToken = localStorage.getItem("cvm_token")    || "";

      // 2.5.2 POST to your Worker’s root URL (e.g. "https://api-8.cvm.rest/")
      const res = await fetch(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, token: authToken })
      });
      if (!res.ok) {
        throw new Error(`Worker responded ${res.status}`);
      }

      const data = await res.json();
      console.log("Server response data:", data);
      // data.embed_url  = "https://api-8.cvm.rest/vm/<sessionId>?token=XXX&no_cbor=1"
      // data.sessionId, data.adminToken, etc.

      // 2.5.3 Validate we got a real URL (avoid typos)
      if (
        !data.embed_url ||
        typeof data.embed_url !== "string" ||
        !data.embed_url.startsWith("https://")
      ) {
        throw new Error("Invalid embed_url received from server");
      }

      // 2.5.4 Initialize Hyperbeam SDK with the “proxied” URL
      const hyperbeamInstance = await Hyperbeam(
        document.getElementById("hyperbeam-container"),
        data.embed_url,
        {
          iframeAttributes: {
            allow: "fullscreen; microphone; camera; autoplay"
          }
        }
      );

      // Debug‐logging WebSocket state
      hyperbeamInstance.on("connectionState", (state) => {
        console.log("[Hyperbeam] connectionState →", state);
      });
      hyperbeamInstance.on("error", (err) => {
        console.error("[Hyperbeam] error event →", err);
      });
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

  const ackCheckbox = document.getElementById('acknowledge-checkbox');
  const closeWarning = document.getElementById('close-warning');
  if (ackCheckbox && closeWarning) {
    ackCheckbox.addEventListener('change', e => {
      closeWarning.disabled = !e.target.checked;
    });
    closeWarning.addEventListener('click', () => {
      const warningOverlay = document.getElementById('warning');
      if (warningOverlay) warningOverlay.classList.remove('active');
      start();
      startTimer();
    });
  }

  // … (remaining overlay/timer/fullscreen code as before) …
}

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
    if (overlay) overlay.style.display = "none";
    if (!started) {
      started = true;
      initApp();
      window.addEventListener('beforeunload', blockUnload);
    }
  }

  if (localStorage.getItem("cvm_token")) {
    finishAuth();
  }

  if (guestBtn) {
    guestBtn.addEventListener("click", finishAuth);
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      isSignup = !isSignup;
      if (titleEl) titleEl.textContent = isSignup ? "Sign Up" : "Log In";
      if (toggle) toggle.textContent = isSignup
        ? "Already have an account? Log in"
        : "Don't have an account? Sign up";
      if (passEl) passEl.style.display = isSignup ? "block" : "none";
      if (errorEl) errorEl.textContent = "";
    });
  }

  if (submit) {
    submit.addEventListener("click", async () => {
      if (errorEl) errorEl.textContent = "";
      const username = userEl ? userEl.value.trim() : "";
      const password = passEl ? passEl.value : "";
      if (!username || (isSignup && !password)) {
        if (errorEl) errorEl.textContent = "Please fill out all required fields.";
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
        if (errorEl) errorEl.textContent = err.message;
      }
    });
  }
});
