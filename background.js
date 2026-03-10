// Background service worker for AI Power Tools
// Provides extension reload via message passing

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "reload-extension") {
    chrome.runtime.reload();
  }
});
