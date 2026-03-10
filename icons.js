// =========================================================================
// AI Power Tools — Shared SVG Icon Helpers (Trusted Types safe)
// =========================================================================
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  function createSVG(width, height, viewBox) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    return svg;
  }

  function chevronDown(size) {
    const svg = createSVG(size, size, "0 0 24 24");
    const poly = document.createElementNS(NS, "polyline");
    poly.setAttribute("points", "6 9 12 15 18 9");
    svg.appendChild(poly);
    return svg;
  }

  function trash(size) {
    const svg = createSVG(size, size, "0 0 24 24");
    ["M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"]
      .forEach((d) => {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
      });
    return svg;
  }

  function x(size) {
    const svg = createSVG(size, size, "0 0 24 24");
    const l1 = document.createElementNS(NS, "line");
    l1.setAttribute("x1", "18"); l1.setAttribute("y1", "6");
    l1.setAttribute("x2", "6"); l1.setAttribute("y2", "18");
    svg.appendChild(l1);
    const l2 = document.createElementNS(NS, "line");
    l2.setAttribute("x1", "6"); l2.setAttribute("y1", "6");
    l2.setAttribute("x2", "18"); l2.setAttribute("y2", "18");
    svg.appendChild(l2);
    return svg;
  }

  function queueAdd(size) {
    const svg = createSVG(size, size, "0 0 24 24");
    [{ d: "M4 6h10" }, { d: "M4 12h10" }, { d: "M4 18h7" }, { d: "M19 15v6" }, { d: "M16 18h6" }]
      .forEach(({ d }) => {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
      });
    return svg;
  }

  function grip(size) {
    const svg = createSVG(size, size, "0 0 24 24");
    [{ cx: "9", cy: "5" }, { cx: "9", cy: "12" }, { cx: "9", cy: "19" },
     { cx: "15", cy: "5" }, { cx: "15", cy: "12" }, { cx: "15", cy: "19" }]
      .forEach(({ cx, cy }) => {
        const circle = document.createElementNS(NS, "circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", "1.5");
        circle.setAttribute("fill", "currentColor");
        circle.setAttribute("stroke", "none");
        svg.appendChild(circle);
      });
    return svg;
  }

  function scrollArrow(size) {
    const svg = createSVG(size, size, "0 0 24 24");
    svg.setAttribute("stroke-width", "2.5");
    const poly = document.createElementNS(NS, "polyline");
    poly.setAttribute("points", "6 9 12 15 18 9");
    svg.appendChild(poly);
    return svg;
  }

  window.AIPowerTools = window.AIPowerTools || {};
  window.AIPowerTools.icons = {
    createSVG,
    chevronDown,
    trash,
    x,
    queueAdd,
    grip,
    scrollArrow,
  };
})();
