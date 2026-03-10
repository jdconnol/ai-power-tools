// =========================================================================
// AI Power Tools — Provider Detection & Configuration
// Runs first. Detects hostname, checks storage toggle, exposes config.
// Other scripts wait for the __aipt_ready__ event before booting.
// =========================================================================
(function () {
  "use strict";

  window.AIPowerTools = window.AIPowerTools || {};

  // Dev helper: reload extension via custom DOM event
  document.addEventListener("__aipt_reload__", () => {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "reload-extension" });
    }
  });

  // =========================================================================
  // Provider definitions
  // =========================================================================
  const PROVIDERS = {
    gemini: {
      id: "gemini",
      name: "Gemini",
      hostname: "gemini.google.com",
      storageKey: "enableGemini",

      // --- DOM selectors ---
      selectors: {
        // Editor / input
        editor: ".ql-editor",
        editorFallbacks: ["[contenteditable='true']"],
        sendButton: [
          ".send-button",
          'button[aria-label="Send message"]',
          'button[data-test-id="send-button"]',
        ],
        inputBar: [
          ".ql-editor",
          "[contenteditable='true']",
          "rich-textarea",
          ".text-input-field",
          "textarea",
          "[aria-label*='prompt']",
          "[aria-label*='Ask']",
          ".input-area-container",
          ".prompt-container",
        ],
        inputArea: [
          "fieldset.input-area-container",
          "fieldset",
        ],

        // Chat messages
        userMessages: "user-query, .user-query, [data-test-id='user-query']",
        chatAnchors: ["model-response", "user-query", ".conversation-container"],

        // Scrollable container
        knownScrollContainers: [
          ".chat-history-scroll-container",
          "[data-test-id='chat-history']",
          "#chat-history",
          ".chat-history",
        ],

        // Platform sidebar
        platformSidebar: ["bard-sidenav", '[role="navigation"]'],
      },

      // --- Sidebar detection for isSidebarElement() ---
      isSidebarElement(el) {
        let node = el;
        while (node && node !== document.body) {
          const tag = node.tagName ? node.tagName.toLowerCase() : "";
          const cls = node.className && typeof node.className === "string"
            ? node.className.toLowerCase() : "";
          const role = node.getAttribute ? node.getAttribute("role") || "" : "";
          const testId = node.getAttribute ? node.getAttribute("data-test-id") || "" : "";
          if (
            tag === "bard-sidenav" || tag === "conversations-list" ||
            role === "navigation" || cls.includes("sidenav") ||
            cls.includes("side-nav") || cls.includes("sidebar") ||
            testId === "all-conversations" || testId === "side-nav"
          ) return true;
          node = node.parentElement;
        }
        return false;
      },

      // --- Busy detection ---
      isBusy() {
        if (document.querySelector('button[aria-label="Stop response"]')) return true;
        if (document.querySelector("model-response mat-progress-spinner")) return true;
        const responses = document.querySelectorAll("model-response");
        if (responses.length > 0) {
          const last = responses[responses.length - 1];
          const hasActions = last.querySelector(
            'button[aria-label="Good response"], button[aria-label="Copy"], button[aria-label="Bad response"]'
          );
          const hasContent = last.querySelector(".response-container, .model-response-text");
          if (hasContent && !hasActions) return true;
        }
        return false;
      },
      busyObserverConfig: { childList: true, subtree: true },

      // --- Editor helpers ---
      getEditor() {
        return document.querySelector(".ql-editor");
      },
      getSendButton() {
        return (
          document.querySelector(".send-button") ||
          document.querySelector('button[aria-label="Send message"]') ||
          document.querySelector('button[data-test-id="send-button"]')
        );
      },
      isSendButtonDisabled(btn) {
        return btn.getAttribute("aria-disabled") === "true";
      },

      // --- Navigator helpers ---
      getPlatformSidebarWidth() {
        const sidenav = document.querySelector("bard-sidenav");
        if (sidenav) return sidenav.getBoundingClientRect().right;
        const nav = document.querySelector('[role="navigation"]');
        if (nav) return nav.getBoundingClientRect().right;
        return 308;
      },
      getPlatformSidebarElement() {
        return document.querySelector("bard-sidenav") ||
          document.querySelector('[role="navigation"]');
      },
      shouldAutoHide(sidebarWidth, remainingSpace) {
        return remainingSpace < 600;
      },
      extractPrompts() {
        const prompts = [];
        const elements = document.querySelectorAll(
          "user-query, .user-query, [data-test-id='user-query']"
        );
        elements.forEach((el, i) => {
          const textEl = el.querySelector(".query-text") ||
            el.querySelector(".user-query-text") || el;
          let text = (textEl.textContent || "").trim();
          text = text.replace(/^You said\s+/i, "");
          if (!text) return;
          prompts.push({ index: i, text, element: el });
        });
        return prompts;
      },

      // --- Queue button positioning ---
      positionQueueButton(btn) {
        const inputArea =
          document.querySelector("fieldset.input-area-container") ||
          document.querySelector("fieldset") ||
          (window.AIPowerTools.findInputBar ? window.AIPowerTools.findInputBar() : null);
        if (inputArea) {
          const rect = inputArea.getBoundingClientRect();
          const btnWidth = btn.getBoundingClientRect().width || 80;
          const centerX = rect.left + rect.width / 2;
          btn.style.top = rect.bottom - 40 + "px";
          btn.style.left = (centerX - btnWidth / 2) + "px";
        }
      },

      // --- Scroll container search: provider-specific anchors ---
      findScrollContainerAnchors() {
        return (
          document.querySelector("model-response") ||
          document.querySelector("user-query") ||
          document.querySelector(".conversation-container")
        );
      },
    },

    chatgpt: {
      id: "chatgpt",
      name: "ChatGPT",
      hostname: "chatgpt.com",
      storageKey: "enableChatGPT",

      selectors: {
        editor: "#prompt-textarea",
        editorFallbacks: [".ProseMirror", "[contenteditable='true']"],
        sendButton: [
          '[data-testid="send-button"]',
          'button[aria-label="Send prompt"]',
          'form button[type="submit"]',
        ],
        inputBar: [
          "#prompt-textarea",
          ".ProseMirror",
          "[contenteditable='true']",
          "textarea",
          "[aria-label*='prompt']",
          "[aria-label*='Message']",
        ],
        inputArea: ["form"],
        userMessages: '[data-message-author-role="user"]',
        chatAnchors: [
          '[data-message-author-role="assistant"]',
          '[data-message-author-role="user"]',
          'article[data-testid^="conversation-turn"]',
        ],
        knownScrollContainers: [],
        platformSidebar: ["nav"],
      },

      isSidebarElement(el) {
        let node = el;
        while (node && node !== document.body) {
          const tag = node.tagName ? node.tagName.toLowerCase() : "";
          const cls = node.className && typeof node.className === "string"
            ? node.className.toLowerCase() : "";
          const role = node.getAttribute ? node.getAttribute("role") || "" : "";
          const testId = node.getAttribute ? node.getAttribute("data-testid") || "" : "";
          if (
            tag === "nav" || role === "navigation" ||
            cls.includes("sidebar") || cls.includes("side-nav") ||
            cls.includes("sidenav") ||
            testId === "conversation-panel" || testId === "sidebar"
          ) return true;
          node = node.parentElement;
        }
        return false;
      },

      isBusy() {
        if (document.querySelector('[data-testid="stop-button"]')) return true;
        if (document.querySelector('button[aria-label="Stop generating"]')) return true;
        if (document.querySelector('button[aria-label="Stop"]')) return true;
        if (document.querySelector('[data-is-streaming="true"]')) return true;
        if (document.querySelector(".result-thinking")) return true;
        const assistantMsgs = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (assistantMsgs.length > 0) {
          const last = assistantMsgs[assistantMsgs.length - 1];
          const cursor = last.querySelector('.cursor, .blinking-cursor, [class*="cursor"]');
          if (cursor) return true;
        }
        return false;
      },
      busyObserverConfig: { childList: true, subtree: true },

      getEditor() {
        return (
          document.querySelector("#prompt-textarea") ||
          document.querySelector(".ProseMirror") ||
          document.querySelector("[contenteditable='true']")
        );
      },
      getSendButton() {
        return (
          document.querySelector('[data-testid="send-button"]') ||
          document.querySelector('button[aria-label="Send prompt"]') ||
          document.querySelector('form button[type="submit"]')
        );
      },
      isSendButtonDisabled(btn) {
        return btn.disabled;
      },

      getPlatformSidebarWidth() {
        const nav = document.querySelector("nav");
        if (nav) {
          const rect = nav.getBoundingClientRect();
          if (rect.width > 10) return rect.right;
        }
        return 0;
      },
      getPlatformSidebarElement() {
        return document.querySelector("nav");
      },
      shouldAutoHide(sidebarWidth, remainingSpace) {
        return sidebarWidth > 100 || remainingSpace < 600;
      },
      extractPrompts() {
        const prompts = [];
        const elements = document.querySelectorAll('[data-message-author-role="user"]');
        elements.forEach((el, i) => {
          let text = (el.textContent || "").trim();
          if (!text) return;
          const turn = el.closest('article[data-testid^="conversation-turn"]') || el;
          prompts.push({ index: i, text, element: turn });
        });
        return prompts;
      },

      positionQueueButton(btn) {
        const inputArea =
          document.querySelector("form") ||
          (window.AIPowerTools.findInputBar ? window.AIPowerTools.findInputBar() : null);
        if (inputArea) {
          const rect = inputArea.getBoundingClientRect();
          btn.style.top = rect.bottom - 40 + "px";
          btn.style.left = rect.right - 180 + "px";
        }
      },

      findScrollContainerAnchors() {
        return (
          document.querySelector('[data-message-author-role="assistant"]') ||
          document.querySelector('[data-message-author-role="user"]') ||
          document.querySelector('article[data-testid^="conversation-turn"]')
        );
      },
    },

    claude: {
      id: "claude",
      name: "Claude",
      hostname: "claude.ai",
      storageKey: "enableClaude",

      selectors: {
        editor: '[data-testid="chat-input"]',
        editorFallbacks: [".tiptap.ProseMirror", "[contenteditable='true']"],
        sendButton: [
          'button[aria-label="Send message"]',
          'button[aria-label="Send"]',
        ],
        inputBar: [
          '[data-testid="prompt-input-ssr-interactive"]',
          '[data-testid="chat-input"]',
          ".tiptap.ProseMirror",
          "[contenteditable='true']",
          '[data-testid="chat-input-ssr"]',
          '[aria-label*="prompt"]',
          '[aria-label*="Write your prompt"]',
        ],
        inputArea: [
          '[data-testid="prompt-input-ssr-interactive"]',
        ],
        userMessages: '[data-testid="user-message"]',
        chatAnchors: ['[data-testid="user-message"]', ".font-claude-response"],
        knownScrollContainers: [],
        platformSidebar: [".z-sidebar", 'nav[aria-label="Sidebar"]'],
      },

      isSidebarElement(el) {
        let node = el;
        while (node && node !== document.body) {
          const tag = node.tagName ? node.tagName.toLowerCase() : "";
          const cls = node.className && typeof node.className === "string"
            ? node.className.toLowerCase() : "";
          const role = node.getAttribute ? node.getAttribute("role") || "" : "";
          const ariaLabel = node.getAttribute ? node.getAttribute("aria-label") || "" : "";
          if (
            tag === "nav" || role === "navigation" || ariaLabel === "Sidebar" ||
            cls.includes("sidebar") || cls.includes("side-nav") ||
            cls.includes("sidenav") || cls.includes("z-sidebar")
          ) return true;
          node = node.parentElement;
        }
        return false;
      },

      isBusy() {
        if (document.querySelector('[data-is-streaming="true"]')) return true;
        if (document.querySelector('button[aria-label="Stop response"]')) return true;
        if (document.querySelector('button[aria-label="Stop"]')) return true;
        const responses = document.querySelectorAll(".font-claude-response");
        if (responses.length > 0) {
          const lastResponse = responses[responses.length - 1];
          const streamingParent = lastResponse.closest("[data-is-streaming]");
          if (streamingParent && streamingParent.getAttribute("data-is-streaming") === "true") {
            return true;
          }
        }
        return false;
      },
      busyObserverConfig: {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-is-streaming"],
      },

      getEditor() {
        return (
          document.querySelector('[data-testid="chat-input"]') ||
          document.querySelector(".tiptap.ProseMirror") ||
          document.querySelector("[contenteditable='true']")
        );
      },
      getSendButton() {
        return (
          document.querySelector('button[aria-label="Send message"]') ||
          document.querySelector('button[aria-label="Send"]')
        );
      },
      isSendButtonDisabled(btn) {
        return btn.disabled;
      },

      getPlatformSidebarWidth() {
        const sidebarContainer = document.querySelector(".z-sidebar");
        if (sidebarContainer) {
          const rect = sidebarContainer.getBoundingClientRect();
          if (rect.width > 10) return rect.right;
        }
        const nav = document.querySelector('nav[aria-label="Sidebar"]');
        if (nav) {
          const rect = nav.getBoundingClientRect();
          if (rect.width > 10) return rect.right;
        }
        return 49;
      },
      getPlatformSidebarElement() {
        return document.querySelector(".z-sidebar") ||
          document.querySelector('nav[aria-label="Sidebar"]');
      },
      shouldAutoHide(sidebarWidth, remainingSpace) {
        return sidebarWidth > 100 || remainingSpace < 600;
      },
      extractPrompts() {
        const prompts = [];
        const elements = document.querySelectorAll('[data-testid="user-message"]');
        elements.forEach((el, i) => {
          let text = (el.textContent || "").trim();
          if (!text) return;
          let turn = el;
          let node = el.parentElement;
          while (node && node !== document.body) {
            if (node.classList.contains("mb-1") && node.classList.contains("mt-6")) {
              turn = node;
              break;
            }
            if (node.parentElement && node.parentElement.classList.contains("flex-1") &&
                node.parentElement.classList.contains("flex-col")) {
              turn = node;
              break;
            }
            node = node.parentElement;
          }
          prompts.push({ index: i, text, element: turn });
        });
        return prompts;
      },

      positionQueueButton(btn) {
        const inputArea =
          document.querySelector('[data-testid="prompt-input-ssr-interactive"]') ||
          (window.AIPowerTools.findInputBar ? window.AIPowerTools.findInputBar() : null);
        if (inputArea) {
          const rect = inputArea.getBoundingClientRect();
          btn.style.top = rect.bottom - 40 + "px";
          btn.style.left = rect.right - 180 + "px";
        }
      },

      findScrollContainerAnchors() {
        return (
          document.querySelector('[data-testid="user-message"]') ||
          document.querySelector(".font-claude-response")
        );
      },
    },
  };

  // =========================================================================
  // Detect current provider by hostname
  // =========================================================================
  function detectProvider() {
    const host = location.hostname;
    for (const key of Object.keys(PROVIDERS)) {
      if (host.includes(PROVIDERS[key].hostname)) {
        return PROVIDERS[key];
      }
    }
    return null;
  }

  // =========================================================================
  // Boot: check storage, set provider, fire ready event
  // =========================================================================
  const detected = detectProvider();
  if (!detected) {
    console.log("[AI Power Tools] No matching provider for", location.hostname);
    return;
  }

  // Check if this provider is enabled in settings
  chrome.storage.sync.get({ [detected.storageKey]: true }, (data) => {
    if (!data[detected.storageKey]) {
      console.log("[AI Power Tools]", detected.name, "is disabled in settings");
      return;
    }

    // Set provider on namespace
    window.AIPowerTools.provider = detected;

    // Set data attribute for CSS theming
    document.documentElement.setAttribute("data-aipt-provider", detected.id);

    console.log("[AI Power Tools] Provider:", detected.name, "— ready");

    // Fire ready event for other scripts
    document.dispatchEvent(new CustomEvent("__aipt_ready__"));
  });
})();
