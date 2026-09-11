const DEFAULT_API_URL = "https://linager.pavneet1804.workers.dev";

// Create context menus upon installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "linager-save-page",
    title: "Save page to Linager",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "linager-save-link",
    title: "Save link to Linager",
    contexts: ["link"]
  });
});

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["linager_token", "linager_api_url"], (res) => {
      resolve({
        token: res.linager_token || "",
        apiUrl: res.linager_api_url || DEFAULT_API_URL
      });
    });
  });
}

async function saveLinkToLinager(url, title = "", tags = "") {
  const { token, apiUrl } = await getConfig();
  if (!token) {
    chrome.notifications?.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Linager: Setup Required",
      message: "Please click the Linager extension icon to connect your API key first."
    });
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/api/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ url, title, tags })
    });

    if (res.ok) {
      const data = await res.json();
      chrome.notifications?.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Saved to Linager! 🔗",
        message: data.title ? `"${data.title}" saved successfully.` : "Link saved to your Linager dashboard."
      });
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save link");
    }
  } catch (err) {
    chrome.notifications?.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Linager Save Failed",
      message: err.message
    });
  }
}

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "linager-save-page" && tab) {
    saveLinkToLinager(tab.url, tab.title);
  } else if (info.menuItemId === "linager-save-link" && info.linkUrl) {
    saveLinkToLinager(info.linkUrl);
  }
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-save") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        saveLinkToLinager(tabs[0].url, tabs[0].title);
      }
    });
  }
});
