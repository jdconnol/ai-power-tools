// =========================================================================
// AI Power Tools — Message Queue (parameterized by provider)
// Waits for __aipt_ready__ before booting.
// =========================================================================
(function () {
  "use strict";

  function boot() {
    const P = window.AIPowerTools.provider;
    if (!P) return;
    const icons = window.AIPowerTools.icons;

    const PANEL_ID = "aipt-queue-panel";
    const BTN_ID = "aipt-queue-btn";
    const LOG = "[AI Power Tools Queue]";

    // =====================================================================
    // Settings
    // =====================================================================
    let settings = { queueShortcut: "Enter", queueModifier: "" };

    function loadSettings() {
      if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ queueShortcut: "Enter", queueModifier: "" }, (s) => {
          settings.queueShortcut = s.queueShortcut || "Enter";
          settings.queueModifier = s.queueModifier || "";
        });
        chrome.storage.onChanged.addListener((changes) => {
          if (changes.queueShortcut) settings.queueShortcut = changes.queueShortcut.newValue;
          if (changes.queueModifier) settings.queueModifier = changes.queueModifier.newValue;
        });
      }
    }

    // =====================================================================
    // Queue state
    // =====================================================================
    let queue = [];
    let isProcessing = false;
    let isSendingFromQueue = false;
    let isCollapsed = false;
    let interceptSetup = false;

    function addToQueue(text) {
      queue.push({
        id: Date.now() + "-" + Math.random().toString(36).substr(2, 5),
        text: text,
        addedAt: Date.now(),
      });
      renderQueueUI();
      if (!P.isBusy() && !isProcessing && queue.length === 1) {
        console.log(LOG, "Item added while idle — starting queue processing");
        onBecameIdle();
      }
    }

    function removeFromQueue(id) {
      queue = queue.filter((item) => item.id !== id);
      renderQueueUI();
      if (queue.length === 0) isProcessing = false;
    }

    function clearQueue() {
      queue = [];
      isProcessing = false;
      renderQueueUI();
    }

    function reorderQueue(fromIndex, toIndex) {
      const item = queue.splice(fromIndex, 1)[0];
      queue.splice(toIndex, 0, item);
      renderQueueUI();
    }

    function getNextMessage() {
      if (queue.length === 0) return null;
      return queue.shift();
    }

    // =====================================================================
    // Busy watcher
    // =====================================================================
    function setupBusyWatcher() {
      let wasBusy = false;
      const observer = new MutationObserver(() => {
        const busy = P.isBusy();
        if (busy !== wasBusy) {
          wasBusy = busy;
          if (!busy) onBecameIdle();
        }
      });
      observer.observe(document.body, P.busyObserverConfig);
    }

    // =====================================================================
    // Auto-processing
    // =====================================================================
    function onBecameIdle() {
      console.log(LOG, "Became idle. Queue length:", queue.length);
      if (queue.length === 0) {
        isProcessing = false;
        return;
      }
      isProcessing = true;

      setTimeout(async () => {
        if (P.isBusy()) {
          console.log(LOG, "Still busy after delay, skipping");
          return;
        }
        const nextItem = getNextMessage();
        if (!nextItem) {
          isProcessing = false;
          return;
        }
        console.log(LOG, "Auto-sending next:", nextItem.text.substring(0, 50));
        renderQueueUI();

        const success = await sendMessage(nextItem.text);
        if (!success) {
          console.log(LOG, "Auto-send failed, re-queuing");
          queue.unshift(nextItem);
          isProcessing = false;
          renderQueueUI();
        } else {
          console.log(LOG, "Auto-send succeeded");
        }
      }, 1500);
    }

    // =====================================================================
    // Programmatic message sending
    // =====================================================================
    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function sendMessage(text) {
      const editor = P.getEditor();
      if (!editor) return false;

      console.log(LOG, "sendMessage: attempting to type:", text.substring(0, 50));

      editor.focus();
      await delay(50);

      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await delay(50);

      document.execCommand("insertText", false, text);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      await delay(300);

      // Wait for send button to be enabled
      let sendBtn = null;
      for (let i = 0; i < 15; i++) {
        sendBtn = P.getSendButton();
        if (sendBtn && !P.isSendButtonDisabled(sendBtn)) break;
        await delay(200);
      }

      if (!sendBtn || P.isSendButtonDisabled(sendBtn)) {
        console.log(LOG, "sendMessage: send button not available after waiting");
        return false;
      }

      console.log(LOG, "sendMessage: clicking send button");
      isSendingFromQueue = true;
      sendBtn.click();
      isSendingFromQueue = false;
      return true;
    }

    // =====================================================================
    // Send interception
    // =====================================================================
    function shouldInterceptSend() {
      if (isSendingFromQueue) return false;
      return P.isBusy() || queue.length > 0;
    }

    function getEditorText() {
      const editor = P.getEditor();
      if (!editor) return "";
      return editor.innerText.trim();
    }

    function clearEditor() {
      const editor = P.getEditor();
      if (!editor) return;
      editor.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContent" }));
    }

    function interceptAndQueue() {
      const text = getEditorText();
      if (!text) return;
      console.log(LOG, "Intercepted send, queuing:", text.substring(0, 50));
      addToQueue(text);
      clearEditor();
    }

    function explicitAddToQueue() {
      const text = getEditorText();
      if (!text) return;
      console.log(LOG, "Explicit add to queue:", text.substring(0, 50));
      addToQueue(text);
      clearEditor();
    }

    function isModifierPressed(e, modifier) {
      switch (modifier.toLowerCase()) {
        case "ctrl": return e.ctrlKey;
        case "alt": return e.altKey;
        case "shift": return e.shiftKey;
        case "meta": case "cmd": return e.metaKey;
        default: return false;
      }
    }

    function setupSendInterception() {
      if (interceptSetup) return;
      const editor = P.getEditor();
      if (!editor) return;

      console.log(LOG, "Setting up send interception on editor:", editor.tagName, editor.className);

      // Intercept Enter key (capture phase)
      document.addEventListener("keydown", function (e) {
        const currentEditor = P.getEditor();
        if (!currentEditor || (!currentEditor.contains(document.activeElement) && document.activeElement !== currentEditor)) {
          return;
        }

        // Explicit "add to queue" shortcut
        if (
          settings.queueModifier &&
          e.key === settings.queueShortcut &&
          isModifierPressed(e, settings.queueModifier)
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          explicitAddToQueue();
          return;
        }

        // Auto-intercept: normal Enter while busy
        if (e.key === "Enter" && !e.shiftKey) {
          const shouldIntercept = shouldInterceptSend();
          if (shouldIntercept) {
            e.preventDefault();
            e.stopImmediatePropagation();
            interceptAndQueue();
          }
        }
      }, true);

      // Intercept send button clicks (capture phase)
      // Use mousedown + pointerdown + click to catch before ChatGPT's handlers
      function interceptSendClick(e) {
        const sendBtn = P.getSendButton();
        if (!sendBtn) return;
        if (e.target === sendBtn || sendBtn.contains(e.target)) {
          if (shouldInterceptSend()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.type === "click" || e.type === "pointerdown") {
              interceptAndQueue();
            }
          }
        }
      }
      document.addEventListener("pointerdown", interceptSendClick, true);
      document.addEventListener("mousedown", interceptSendClick, true);
      document.addEventListener("click", interceptSendClick, true);

      // Intercept form submit (catches programmatic submissions)
      const form = editor.closest("form");
      if (form) {
        form.addEventListener("submit", function (e) {
          if (shouldInterceptSend()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            interceptAndQueue();
          }
        }, true);
        console.log(LOG, "Form submit interception added");
      }

      interceptSetup = true;
      console.log(LOG, "Send interception setup complete");
    }

    // =====================================================================
    // Queue UI rendering
    // =====================================================================
    function renderQueueUI() {
      let panel = document.getElementById(PANEL_ID);

      if (!panel) {
        panel = document.createElement("div");
        panel.id = PANEL_ID;
        document.body.appendChild(panel);
        injectAddToQueueButton();
      }

      if (queue.length === 0) {
        panel.classList.remove("gq-visible");
        if (window.AIPowerTools.positionScrollButton) window.AIPowerTools.positionScrollButton();
        return;
      }

      panel.classList.add("gq-visible");
      panel.classList.toggle("gq-collapsed", isCollapsed);

      while (panel.firstChild) panel.removeChild(panel.firstChild);

      // Header
      const header = document.createElement("div");
      header.className = "gq-header";
      header.addEventListener("click", (e) => {
        if (!e.target.closest(".gq-clear-btn")) {
          isCollapsed = !isCollapsed;
          panel.classList.toggle("gq-collapsed", isCollapsed);
        }
      });

      const collapseBtn = document.createElement("button");
      collapseBtn.className = "gq-collapse-btn";
      collapseBtn.appendChild(icons.chevronDown(14));
      header.appendChild(collapseBtn);

      const label = document.createElement("span");
      label.className = "gq-label";
      label.textContent = "Queue";
      header.appendChild(label);

      const badge = document.createElement("span");
      badge.className = "gq-badge";
      badge.textContent = String(queue.length);
      header.appendChild(badge);

      const clearBtn = document.createElement("button");
      clearBtn.className = "gq-clear-btn";
      clearBtn.title = "Clear queue";
      clearBtn.appendChild(icons.trash(14));
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearQueue();
      });
      header.appendChild(clearBtn);

      panel.appendChild(header);

      // Items
      const itemsContainer = document.createElement("div");
      itemsContainer.className = "gq-items";

      queue.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "gq-item";
        row.draggable = true;
        row.dataset.index = String(index);

        const handle = document.createElement("span");
        handle.className = "gq-item-handle";
        handle.title = "Drag to reorder";
        handle.appendChild(icons.grip(12));
        row.appendChild(handle);

        if (index === 0) {
          const nextBadge = document.createElement("span");
          nextBadge.className = "gq-item-badge";
          nextBadge.textContent = "Next";
          row.appendChild(nextBadge);
        }

        const textEl = document.createElement("span");
        textEl.className = "gq-item-text";
        textEl.textContent = item.text.length > 80 ? item.text.substring(0, 80) + "\u2026" : item.text;
        textEl.title = item.text;
        row.appendChild(textEl);

        const removeBtn = document.createElement("button");
        removeBtn.className = "gq-item-remove";
        removeBtn.title = "Remove";
        removeBtn.appendChild(icons.x(12));
        removeBtn.addEventListener("click", () => removeFromQueue(item.id));
        row.appendChild(removeBtn);

        // Drag events
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(index));
          row.classList.add("gq-item-dragging");
        });
        row.addEventListener("dragend", () => {
          row.classList.remove("gq-item-dragging");
          itemsContainer.querySelectorAll(".gq-item-dragover").forEach((el) => el.classList.remove("gq-item-dragover"));
        });
        row.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          row.classList.add("gq-item-dragover");
        });
        row.addEventListener("dragleave", () => row.classList.remove("gq-item-dragover"));
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          row.classList.remove("gq-item-dragover");
          const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
          if (fromIdx !== index) reorderQueue(fromIdx, index);
        });

        itemsContainer.appendChild(row);
      });

      panel.appendChild(itemsContainer);
      positionQueuePanel();
      if (window.AIPowerTools.positionScrollButton) window.AIPowerTools.positionScrollButton();
    }

    // =====================================================================
    // Queue UI positioning
    // =====================================================================
    function positionQueuePanel() {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      const inputBar = window.AIPowerTools.findInputBar ? window.AIPowerTools.findInputBar() : null;
      if (!inputBar) return;
      const rect = inputBar.getBoundingClientRect();
      panel.style.left = rect.left + "px";
      panel.style.width = rect.width + "px";
      panel.style.bottom = window.innerHeight - rect.top + 8 + "px";
    }

    // =====================================================================
    // "Add to Queue" button
    // =====================================================================
    function injectAddToQueueButton() {
      if (document.getElementById(BTN_ID)) return;

      const btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.title = "Add to Queue";
      btn.setAttribute("aria-label", "Add message to queue");
      btn.appendChild(icons.queueAdd(18));

      const label = document.createElement("span");
      label.className = "gq-add-label";
      label.textContent = "Queue";
      btn.appendChild(label);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        explicitAddToQueue();
      });

      document.body.appendChild(btn);
      positionAddToQueueButton();
      window.addEventListener("resize", positionAddToQueueButton);
    }

    function positionAddToQueueButton() {
      const btn = document.getElementById(BTN_ID);
      if (!btn) return;
      P.positionQueueButton(btn);
    }

    // =====================================================================
    // Initialization
    // =====================================================================
    function init() {
      loadSettings();
      setupBusyWatcher();

      function trySetup() {
        setupSendInterception();
        injectAddToQueueButton();
        positionAddToQueueButton();
        positionQueuePanel();
      }

      trySetup();

      let attempts = 0;
      const interval = setInterval(() => {
        trySetup();
        attempts++;
        if (attempts >= 30 || interceptSetup) clearInterval(interval);
      }, 1000);

      let mutTimer = null;
      const obs = new MutationObserver(() => {
        if (mutTimer) clearTimeout(mutTimer);
        mutTimer = setTimeout(trySetup, 500);
      });
      obs.observe(document.body, { childList: true, subtree: true });

      // Re-init on SPA navigation
      if (window.AIPowerTools.onNavigate) {
        window.AIPowerTools.onNavigate(() => {
          interceptSetup = false;
          isProcessing = false;
          isSendingFromQueue = false;
          setTimeout(trySetup, 1000);
        });
      }
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(init, 1200);
    } else {
      document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1200));
    }
  }

  // Wait for provider ready event
  if (window.AIPowerTools && window.AIPowerTools.provider) {
    boot();
  } else {
    document.addEventListener("__aipt_ready__", boot, { once: true });
  }
})();
