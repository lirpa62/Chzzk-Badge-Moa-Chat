(() => {
  const ns = (window.__chzzkBadgeMoa = window.__chzzkBadgeMoa || {});
  if (ns.fontsInjected) return;
  ns.fontsInjected = true;

  const metricOverrides = `
    font-display: block;
    size-adjust: 100%;
    ascent-override: 88%;
    descent-override: 22%;
    line-gap-override: 0%;
  `;

  const faces = [
    {
      family: "Pretendard Variable",
      file: "fonts/PretendardVariable.woff2",
      format: "woff2",
      weight: "45 920",
    },
    {
      family: "Escoredream",
      file: "fonts/S-CoreDream-4Regular.woff",
      format: "woff",
      weight: "400",
    },
    {
      family: "Escoredream",
      file: "fonts/S-CoreDream-5Medium.woff",
      format: "woff",
      weight: "500",
    },
    {
      family: "Escoredream",
      file: "fonts/S-CoreDream-6Bold.woff",
      format: "woff",
      weight: "600",
    },
    {
      family: "Escoredream",
      file: "fonts/S-CoreDream-7ExtraBold.woff",
      format: "woff",
      weight: "700",
    },
  ];

  const cssText = faces
    .map(
      ({ family, file, format, weight }) => `
      @font-face {
        font-family: "${family}";
        src: url("${chrome.runtime.getURL(file)}") format("${format}");
        font-weight: ${weight};
        ${metricOverrides}
      }
    `,
    )
    .join("\n");

  const style = document.createElement("style");
  style.setAttribute("data-chzzk-badge-moa-fonts", "1");
  style.textContent = cssText;

  const attach = () => {
    const target = document.head || document.documentElement;
    if (!target) {
      requestAnimationFrame(attach);
      return;
    }
    target.appendChild(style);
  };
  attach();
})();
