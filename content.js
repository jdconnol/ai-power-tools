// =========================================================================
// AI Power Tools — Scroll-to-Bottom + Shared Utilities (parameterized)
// Waits for __aipt_ready__ before booting.
// =========================================================================
(function () {
  "use strict";

  function boot() {
    const P = window.AIPowerTools.provider;
    if (!P) return;

    const BUTTON_ID = "aipt-scroll-btn";
    let cachedContainer = null;

    // Navigation callbacks — other scripts push handlers here
    const navigateCallbacks = [];
    window.AIPowerTools.onNavigate = function (fn) {
      navigateCallbacks.push(fn);
    };

    // Expose isSidebarElement from provider
    window.AIPowerTools.isSidebarElement = P.isSidebarElement;

    // =====================================================================
    // Find the scrollable chat container
    // =====================================================================
    function findScrollableContainer() {
      if (
        cachedContainer &&
        document.contains(cachedContainer) &&
        cachedContainer.scrollHeight > cachedContainer.clientHeight
      ) {
        return cachedContainer;
      }

      // 1. Try provider-specific known selectors
      for (const selector of (P.selectors.knownScrollContainers || [])) {
        const el = document.querySelector(selector);
        if (el && el.scrollHeight > el.clientHeight && !P.isSidebarElement(el)) {
          cachedContainer = el;
          return el;
        }
      }

      // 2. For Claude: try #main-content descendants
      if (P.id === "claude") {
        const mainContent = document.getElementById("main-content");
        if (mainContent) {
          const candidates = mainContent.querySelectorAll("div");
          for (const el of candidates) {
            if (P.isSidebarElement(el)) continue;
            const style = getComputedStyle(el);
            if (
              (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") &&
              el.scrollHeight > el.clientHeight
            ) {
              const width = el.getBoundingClientRect().width;
              if (width > 300) {
                cachedContainer = el;
                return el;
              }
            }
          }
        }
      }

      // 3. For ChatGPT: try main > div children
      if (P.id === "chatgpt") {
        const main = document.querySelector("main");
        if (main) {
          const children = main.querySelectorAll(":scope > div");
          for (const child of children) {
            const style = getComputedStyle(child);
            if (
              (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") &&
              child.scrollHeight > child.clientHeight
            ) {
              cachedContainer = child;
              return child;
            }
          }
          const allInMain = main.querySelectorAll("div");
          for (const el of allInMain) {
            if (P.isSidebarElement(el)) continue;
            const style = getComputedStyle(el);
            if (
              (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") &&
              el.scrollHeight > el.clientHeight + 100
            ) {
              const width = el.getBoundingClientRect().width;
              if (width > 300) {
                cachedContainer = el;
                return el;
              }
            }
          }
        }
      }

      // 4. Walk up from a chat message anchor
      const chatMessage = P.findScrollContainerAnchors();
      if (chatMessage) {
        let node = chatMessage.parentElement;
        while (node && node !== document.body) {
          const style = getComputedStyle(node);
          const overflowY = style.overflowY;
          if (
            (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
            node.scrollHeight > node.clientHeight
          ) {
            cachedContainer = node;
            return node;
          }
          node = node.parentElement;
        }
      }

      // 5. Fallback: main element
      const main = document.querySelector("main");
      if (main && main.scrollHeight > main.clientHeight && !P.isSidebarElement(main)) {
        cachedContainer = main;
        return main;
      }

      // 6. Last resort: widest scrollable element
      let best = null;
      let bestScore = 0;
      const allElements = document.querySelectorAll("*");
      for (const el of allElements) {
        if (el === document.documentElement || el === document.body || el.id === BUTTON_ID) continue;
        const style = getComputedStyle(el);
        const overflowY = style.overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
          el.scrollHeight > el.clientHeight + 100
        ) {
          if (P.isSidebarElement(el)) continue;
          const width = el.getBoundingClientRect().width;
          const score = width * 2 + el.scrollHeight;
          if (score > bestScore) {
            best = el;
            bestScore = score;
          }
        }
      }
      if (best) cachedContainer = best;
      return best;
    }
    window.AIPowerTools.findScrollableContainer = findScrollableContainer;

    // =====================================================================
    // Find the text input bar
    // =====================================================================
    function findInputBar() {
      for (const sel of P.selectors.inputBar) {
        const el = document.querySelector(sel);
        if (el) {
          let wrapper = el;
          while (wrapper.parentElement && wrapper.parentElement !== document.body) {
            const rect = wrapper.parentElement.getBoundingClientRect();
            if (rect.width > 300 && rect.height > 30 && rect.height < 200) {
              wrapper = wrapper.parentElement;
            } else {
              break;
            }
          }
          return wrapper;
        }
      }
      return null;
    }
    window.AIPowerTools.findInputBar = findInputBar;

    // =====================================================================
    // Scroll-to-bottom feature
    // =====================================================================
    function scrollToBottom() {
      const container = findScrollableContainer();
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }

    function isNearBottom(container) {
      if (!container) return true;
      return container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    }

    function positionButton() {
      const btn = document.getElementById(BUTTON_ID);
      if (!btn) return;

      const inputBar = findInputBar();
      if (inputBar) {
        const rect = inputBar.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        let topY = rect.top - 10;

        // Account for queue panel
        const queuePanel = document.getElementById("aipt-queue-panel");
        if (queuePanel && queuePanel.classList.contains("gq-visible")) {
          const queueRect = queuePanel.getBoundingClientRect();
          topY = queueRect.top - 10;
        }

        btn.style.left = centerX - 20 + "px";
        btn.style.top = topY - 40 + "px";
        btn.style.bottom = "auto";
        btn.style.right = "auto";
      }
    }
    window.AIPowerTools.positionScrollButton = positionButton;

    function updateButtonVisibility() {
      const btn = document.getElementById(BUTTON_ID);
      if (!btn) return;
      const container = findScrollableContainer();
      if (!container || isNearBottom(container)) {
        btn.classList.add("gsb-hidden");
      } else {
        btn.classList.remove("gsb-hidden");
        positionButton();
      }
    }

    function injectButton() {
      if (document.getElementById(BUTTON_ID)) return;

      const btn = document.createElement("button");
      btn.id = BUTTON_ID;
      btn.title = "Scroll to bottom";
      btn.setAttribute("aria-label", "Scroll to bottom of chat");
      btn.appendChild(window.AIPowerTools.icons.scrollArrow(20));
      btn.addEventListener("click", scrollToBottom);
      document.body.appendChild(btn);

      positionButton();
      window.addEventListener("resize", positionButton);

      let attachedContainer = null;

      function attachScrollListener() {
        const container = findScrollableContainer();
        if (container && container !== attachedContainer) {
          if (attachedContainer) {
            attachedContainer.removeEventListener("scroll", updateButtonVisibility);
          }
          container.addEventListener("scroll", updateButtonVisibility, { passive: true });
          attachedContainer = container;
        }
        updateButtonVisibility();
      }

      attachScrollListener();

      let mutationTimer = null;
      const observer = new MutationObserver(() => {
        if (mutationTimer) clearTimeout(mutationTimer);
        mutationTimer = setTimeout(attachScrollListener, 500);
      });
      observer.observe(document.body, { childList: true, subtree: true });

      let checks = 0;
      const interval = setInterval(() => {
        attachScrollListener();
        checks++;
        if (checks >= 30) clearInterval(interval);
      }, 1000);
    }

    // =====================================================================
    // SPA navigation detection
    // =====================================================================
    let lastUrl = location.href;
    window.AIPowerTools.getLastUrl = () => lastUrl;

    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        cachedContainer = null;

        setTimeout(() => {
          if (!document.getElementById(BUTTON_ID)) {
            injectButton();
          }
          updateButtonVisibility();

          for (const cb of navigateCallbacks) {
            try { cb(); } catch (e) {
              console.error("[AI Power Tools] Navigation callback error:", e);
            }
          }
        }, 1000);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    // =====================================================================
    // Init
    // =====================================================================
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(injectButton, 1000);
    } else {
      document.addEventListener("DOMContentLoaded", () => setTimeout(injectButton, 1000));
    }
  }

  // Wait for provider ready event
  if (window.AIPowerTools && window.AIPowerTools.provider) {
    boot();
  } else {
    document.addEventListener("__aipt_ready__", boot, { once: true });
  }
})();
