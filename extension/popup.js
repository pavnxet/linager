const DEFAULT_API_URL = "https://linager.pavneet1804.workers.dev";

const titleInput = document.getElementById("link-title");
const urlInput = document.getElementById("link-url");
const tagsInput = document.getElementById("link-tags");
const pinInput = document.getElementById("link-pin");
const saveBtn = document.getElementById("btn-save");
const saveBtnText = document.getElementById("btn-text");
const statusBanner = document.getElementById("status-banner");
const userInfo = document.getElementById("user-info");

const viewMain = document.getElementById("view-main");
const viewSettings = document.getElementById("view-settings");
const btnSettings = document.getElementById("btn-settings");
const btnSaveSettings = document.getElementById("btn-save-settings");
const btnCancelSettings = document.getElementById("btn-cancel-settings");
const apiTokenInput = document.getElementById("api-token");
const apiUrlInput = document.getElementById("api-url");

let config = {
  token: "",
  apiUrl: DEFAULT_API_URL,
  username: ""
};

function showBanner(msg, type = "success", autoHideMs = 3000) {
  statusBanner.textContent = msg;
  statusBanner.className = `status-banner ${type}`;
  statusBanner.classList.remove("hidden");
  if (autoHideMs > 0) {
    setTimeout(() => {
      statusBanner.classList.add("hidden");
    }, autoHideMs);
  }
}

async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["linager_token", "linager_api_url", "linager_username"], (res) => {
      config.token = res.linager_token || "";
      config.apiUrl = res.linager_api_url || DEFAULT_API_URL;
      config.username = res.linager_username || "";
      resolve(config);
    });
  });
}

async function saveConfig(token, apiUrl, username = "") {
  return new Promise((resolve) => {
    chrome.storage.sync.set({
      linager_token: token,
      linager_api_url: apiUrl,
      linager_username: username
    }, () => {
      config.token = token;
      config.apiUrl = apiUrl;
      config.username = username;
      resolve();
    });
  });
}

function updateUserInfoUI() {
  if (config.token) {
    userInfo.textContent = config.username ? `@${config.username}` : "Connected";
    userInfo.style.color = "#3fb950";
  } else {
    userInfo.textContent = "Not connected";
    userInfo.style.color = "var(--text-muted)";
  }
}

async function verifyToken(token, apiUrl) {
  const res = await fetch(`${apiUrl}/api/auth/me`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error("Invalid or expired token");
  const data = await res.json();
  return data.user?.username || "user";
}

async function init() {
  await loadConfig();
  updateUserInfoUI();

  // If no token is set, switch directly to settings view
  if (!config.token) {
    showSettingsView();
    showBanner("Please paste your Extension Key from Linager", "warning", 0);
  } else {
    // Populate active tab details
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const tab = tabs[0];
        urlInput.value = tab.url || "";
        titleInput.value = tab.title || "";
        
        // If url is valid and title is empty, attempt auto-title fetch
        if (urlInput.value && !titleInput.value) {
          fetchTitleFromWorker(urlInput.value);
        }
      }
    });
  }
}

async function fetchTitleFromWorker(url) {
  if (!config.token) return;
  try {
    const res = await fetch(`${config.apiUrl}/api/metadata/fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.token}`
      },
      body: JSON.stringify({ url })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.title && !titleInput.value) {
        titleInput.value = data.title;
      }
    }
  } catch (e) {
    console.warn("Could not fetch title:", e);
  }
}

function showSettingsView() {
  apiTokenInput.value = config.token;
  apiUrlInput.value = config.apiUrl || DEFAULT_API_URL;
  viewMain.classList.add("hidden");
  viewSettings.classList.remove("hidden");
}

function hideSettingsView() {
  viewSettings.classList.add("hidden");
  viewMain.classList.remove("hidden");
}

btnSettings.addEventListener("click", (e) => {
  e.preventDefault();
  if (viewSettings.classList.contains("hidden")) {
    showSettingsView();
  } else {
    hideSettingsView();
  }
});

btnCancelSettings.addEventListener("click", () => {
  hideSettingsView();
});

btnSaveSettings.addEventListener("click", async () => {
  const token = apiTokenInput.value.trim();
  const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, "") || DEFAULT_API_URL;

  if (!token) {
    showBanner("Token cannot be empty", "error");
    return;
  }

  btnSaveSettings.disabled = true;
  btnSaveSettings.textContent = "Verifying...";

  try {
    const username = await verifyToken(token, apiUrl);
    await saveConfig(token, apiUrl, username);
    updateUserInfoUI();
    hideSettingsView();
    showBanner(`Connected as @${username}! 🎉`, "success");
  } catch (err) {
    showBanner(`Verification failed: ${err.message}`, "error");
  } finally {
    btnSaveSettings.disabled = false;
    btnSaveSettings.textContent = "Save & Connect";
  }
});

document.getElementById("save-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  const tags = tagsInput.value.trim();
  const is_pinned = pinInput.checked ? 1 : 0;

  if (!url) {
    showBanner("URL is required", "error");
    return;
  }

  if (!config.token) {
    showBanner("Please connect your Extension Key first", "warning");
    showSettingsView();
    return;
  }

  saveBtn.disabled = true;
  saveBtnText.textContent = "Saving to Linager...";

  try {
    const res = await fetch(`${config.apiUrl}/api/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.token}`
      },
      body: JSON.stringify({ url, title, tags, is_pinned })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to save link");
    }

    saveBtnText.textContent = "Saved! 🎉";
    saveBtn.style.background = "#238636";
    showBanner("Link saved successfully! Closing...", "success", 2000);

    setTimeout(() => {
      window.close();
    }, 1100);
  } catch (err) {
    showBanner(err.message, "error");
    saveBtnText.textContent = "Save to Linager";
    saveBtn.disabled = false;
  }
});

init();
