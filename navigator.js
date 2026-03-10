// =========================================================================
// AI Power Tools — Conversation Navigator (parameterized by provider)
// Waits for __aipt_ready__ before booting.
// =========================================================================
(function () {
  "use strict";

  function boot() {
    const P = window.AIPowerTools.provider;
    if (!P) return;

    const SIDEBAR_ID = "aipt-nav-sidebar";
    const TOGGLE_ID = "aipt-nav-toggle";

    let sidebarCollapsed = false;
    let autoHidden = false;
    let activeIndex = -1;

    // Lock flags to prevent scroll feedback loops
    let sidebarDriving = false;
    let mainDriving = false;
    let lockTimer = null;

    // =====================================================================
    // Content push — shift main content right when sidebar is visible
    // =====================================================================
    function updateContentPush() {
      let styleEl = document.getElementById("aipt-content-push");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "aipt-content-push";
        document.head.appendChild(styleEl);
      }

      const isVisible = !sidebarCollapsed && !autoHidden;
      if (isVisible && P.getContentPushCSS) {
        styleEl.textContent = P.getContentPushCSS(200);
      } else {
        styleEl.textContent = "";
      }
    }

    // =====================================================================
    // Position sidebar relative to platform sidebar
    // =====================================================================
    function positionSidebar() {
      const sidebar = document.getElementById(SIDEBAR_ID);
      const toggle = document.getElementById(TOGGLE_ID);
      if (!sidebar) return;

      const platformWidth = P.getPlatformSidebarWidth();
      const navWidth = 200;
      const remainingSpace = window.innerWidth - platformWidth - navWidth;

      const shouldAutoHide = P.shouldAutoHide(platformWidth, remainingSpace);

      if (shouldAutoHide) {
        autoHidden = true;
        sidebar.classList.add("gn-collapsed");
        if (toggle) {
          toggle.style.left = platformWidth + "px";
          toggle.classList.add("gn-toggle-collapsed");
          updateToggleIcon(toggle);
        }
        updateContentPush();
        return;
      }

      // Restore if was auto-hidden and space is now available
      if (autoHidden && !sidebarCollapsed) {
        autoHidden = false;
        sidebar.classList.remove("gn-collapsed");
        if (toggle) toggle.classList.remove("gn-toggle-collapsed");
      }

      const topOffset = P.navTopOffset || 0;
      sidebar.style.left = platformWidth + "px";
      sidebar.style.width = navWidth + "px";
      sidebar.style.top = topOffset + "px";
      sidebar.style.height = "calc(100vh - " + topOffset + "px)";

      if (toggle) {
        toggle.style.left = (sidebarCollapsed ? platformWidth : platformWidth + navWidth) + "px";
        updateToggleIcon(toggle);
      }

      updateContentPush();
    }

    // Watch platform sidebar for resize
    let sidenavObserver = null;
    function watchPlatformSidebar() {
      if (sidenavObserver) return;
      const el = P.getPlatformSidebarElement();
      if (!el) return;
      sidenavObserver = new ResizeObserver(() => positionSidebar());
      sidenavObserver.observe(el);
    }

    // =====================================================================
    // Scroll main chat to a prompt
    // =====================================================================
    function scrollMainToPrompt(promptEl) {
      const container = window.AIPowerTools.findScrollableContainer
        ? window.AIPowerTools.findScrollableContainer() : null;
      if (!container || !promptEl) return;

      mainDriving = true;
      clearTimeout(lockTimer);

      const containerRect = container.getBoundingClientRect();
      const elRect = promptEl.getBoundingClientRect();
      const scrollOffset = elRect.top - containerRect.top + container.scrollTop - 20;

      container.scrollTo({ top: scrollOffset, behavior: "smooth" });

      // Flash highlight the target prompt in the main chat
      promptEl.classList.remove("aipt-flash-highlight");
      void promptEl.offsetWidth; // force reflow to restart animation
      promptEl.classList.add("aipt-flash-highlight");
      setTimeout(() => { promptEl.classList.remove("aipt-flash-highlight"); }, 1300);

      lockTimer = setTimeout(() => { mainDriving = false; }, 800);
    }

    // =====================================================================
    // Determine which prompt is currently in view
    // =====================================================================
    function getCurrentPromptIndex(prompts) {
      const container = window.AIPowerTools.findScrollableContainer
        ? window.AIPowerTools.findScrollableContainer() : null;
      if (!container || prompts.length === 0) return 0;

      const containerRect = container.getBoundingClientRect();
      const viewportMid = containerRect.top + containerRect.height * 0.3;

      let closest = 0;
      let closestDist = Infinity;

      prompts.forEach((p, i) => {
        const rect = p.element.getBoundingClientRect();
        const dist = Math.abs(rect.top - viewportMid);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });

      return closest;
    }

    // =====================================================================
    // Build / rebuild the sidebar
    // =====================================================================
    function buildSidebar() {
      let sidebar = document.getElementById(SIDEBAR_ID);

      if (!sidebar) {
        sidebar = document.createElement("div");
        sidebar.id = SIDEBAR_ID;
        document.body.appendChild(sidebar);

        // Create toggle button
        const toggle = document.createElement("button");
        toggle.id = TOGGLE_ID;
        toggle.title = "Toggle conversation navigator";
        toggle.setAttribute("aria-label", "Toggle conversation navigator");
        toggle.addEventListener("click", () => {
          sidebarCollapsed = !sidebarCollapsed;
          sidebar.classList.toggle("gn-collapsed", sidebarCollapsed);
          toggle.classList.toggle("gn-toggle-collapsed", sidebarCollapsed);
          updateToggleIcon(toggle);
          positionSidebar();
          updateContentPush();
        });
        updateToggleIcon(toggle);
        document.body.appendChild(toggle);
      }

      const prompts = P.extractPrompts();

      // Clear existing items
      const existing = sidebar.querySelector(".gn-list");
      if (existing) existing.remove();

      // Header
      if (!sidebar.querySelector(".gn-header")) {
        const header = document.createElement("div");
        header.className = "gn-header";

        const title = document.createElement("span");
        title.className = "gn-title";
        title.textContent = "Prompts";
        header.appendChild(title);

        const count = document.createElement("span");
        count.className = "gn-count";
        count.textContent = String(prompts.length);
        header.appendChild(count);

        sidebar.appendChild(header);
      } else {
        const count = sidebar.querySelector(".gn-count");
        if (count) count.textContent = String(prompts.length);
      }

      // Prompt list
      const list = document.createElement("div");
      list.className = "gn-list";

      prompts.forEach((p, i) => {
        const item = document.createElement("div");
        item.className = "gn-item";
        if (i === activeIndex) item.classList.add("gn-active");
        item.dataset.index = String(i);

        const truncated = p.text.length > 55 ? p.text.substring(0, 55) + "\u2026" : p.text;
        item.textContent = truncated;
        item.title = p.text;

        item.addEventListener("click", () => {
          setActiveIndex(i, prompts);
          scrollMainToPrompt(p.element);
        });

        list.appendChild(item);
      });

      sidebar.appendChild(list);

      // Set initial active to the last prompt on first build
      if (activeIndex === -1 && prompts.length > 0) {
        setActiveIndex(prompts.length - 1, prompts);
      }

      positionSidebar();
      watchPlatformSidebar();
      requestAnimationFrame(positionSidebar);
      setTimeout(positionSidebar, 300);
      setTimeout(positionSidebar, 1000);
      window.addEventListener("resize", positionSidebar);
      setupScrollSync(prompts, list);

      return prompts;
    }

    // =====================================================================
    // Active state management
    // =====================================================================
    function setActiveIndex(index, prompts) {
      activeIndex = index;
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (!sidebar) return;

      const items = sidebar.querySelectorAll(".gn-item");
      items.forEach((el, i) => el.classList.toggle("gn-active", i === index));

      const activeItem = items[index];
      if (activeItem) {
        const list = sidebar.querySelector(".gn-list");
        if (list) {
          const listRect = list.getBoundingClientRect();
          const itemRect = activeItem.getBoundingClientRect();
          if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
            activeItem.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
      }
    }

    // =====================================================================
    // Scroll synchronization
    // =====================================================================
    function setupScrollSync(prompts, listEl) {
      const container = window.AIPowerTools.findScrollableContainer
        ? window.AIPowerTools.findScrollableContainer() : null;
      if (!container) return;

      // Main scroll → highlight sidebar item
      container.addEventListener("scroll", throttle(() => {
        if (mainDriving || sidebarDriving) return;
        const idx = getCurrentPromptIndex(prompts);
        if (idx !== activeIndex) setActiveIndex(idx, prompts);
      }, 100), { passive: true });

      // Sidebar scroll → drive main conversation
      listEl.addEventListener("scroll", throttle(() => {
        if (mainDriving) return;

        sidebarDriving = true;
        clearTimeout(lockTimer);

        const listRect = listEl.getBoundingClientRect();
        const listCenter = listRect.top + listRect.height / 2;
        const items = listEl.querySelectorAll(".gn-item");
        let closestIdx = 0;
        let closestDist = Infinity;

        items.forEach((item, i) => {
          const itemRect = item.getBoundingClientRect();
          const itemCenter = itemRect.top + itemRect.height / 2;
          const dist = Math.abs(itemCenter - listCenter);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        });

        if (closestIdx !== activeIndex && prompts[closestIdx]) {
          activeIndex = closestIdx;
          items.forEach((el, i) => el.classList.toggle("gn-active", i === closestIdx));
          scrollMainToPrompt(prompts[closestIdx].element);
        }

        lockTimer = setTimeout(() => { sidebarDriving = false; }, 600);
      }, 150), { passive: true });
    }

    // =====================================================================
    // Toggle icon
    // =====================================================================
    function updateToggleIcon(toggle) {
      while (toggle.firstChild) toggle.removeChild(toggle.firstChild);

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");

      if (sidebarCollapsed) {
        [{ y1: "4", y2: "4" }, { y1: "12", y2: "12" }, { y1: "20", y2: "20" }].forEach(({ y1, y2 }) => {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", "3"); line.setAttribute("y1", y1);
          line.setAttribute("x2", "21"); line.setAttribute("y2", y2);
          svg.appendChild(line);
        });
      } else {
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        poly.setAttribute("points", "15 18 9 12 15 6");
        svg.appendChild(poly);
      }

      toggle.appendChild(svg);
    }

    // =====================================================================
    // Utilities
    // =====================================================================
    function throttle(fn, wait) {
      let last = 0;
      return function (...args) {
        const now = Date.now();
        if (now - last >= wait) {
          last = now;
          fn.apply(this, args);
        }
      };
    }

    // =====================================================================
    // Real-time updates — watch for new prompts
    // =====================================================================
    function setupLiveUpdates() {
      let updateTimer = null;
      let lastPromptCount = 0;

      const observer = new MutationObserver(() => {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
          const prompts = P.extractPrompts();
          if (prompts.length !== lastPromptCount) {
            lastPromptCount = prompts.length;
            buildSidebar();
          }
        }, 500);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return observer;
    }

    // =====================================================================
    // Initialization
    // =====================================================================
    function init() {
      buildSidebar();
      setupLiveUpdates();
    }

    // Re-init on SPA navigation
    if (window.AIPowerTools && window.AIPowerTools.onNavigate) {
      window.AIPowerTools.onNavigate(() => {
        activeIndex = -1;
        const sidebar = document.getElementById(SIDEBAR_ID);
        if (sidebar) {
          const list = sidebar.querySelector(".gn-list");
          if (list) list.remove();
          const header = sidebar.querySelector(".gn-header");
          if (header) header.remove();
        }
        setTimeout(init, 1200);
      });
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(init, 1500);
    } else {
      document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1500));
    }
  }

  // Wait for provider ready event
  if (window.AIPowerTools && window.AIPowerTools.provider) {
    boot();
  } else {
    document.addEventListener("__aipt_ready__", boot, { once: true });
  }
})();
