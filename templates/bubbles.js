function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusBubbleHtml(text) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      color: #f8fafc;
      user-select: none;
    }
    .bubble {
      display: grid;
      place-items: center;
      height: 34px;
      margin: 4px;
      padding: 0 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
      font-size: 13px;
      line-height: 1;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="bubble">${escapeHtml(text)}</div>
</body>
</html>`;
}

function speechBubbleHtml(text, durationMs) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      color: #f8fafc;
      user-select: none;
      pointer-events: none;
    }
    .speech {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 170px;
      height: 24px;
      margin: 4px;
      padding: 2px 10px;
      border-radius: 12px;
      background: rgba(20, 20, 20, 0.78);
      font-size: 12px;
      line-height: 1;
      animation: speech-fade ${durationMs}ms ease-in forwards;
      white-space: nowrap;
      letter-spacing: 0.2px;
    }
    @keyframes speech-fade {
      0%, 70% { opacity: 1; }
      100% { opacity: 0; }
    }
  </style>
</head>
<body>
  <div class="speech">${escapeHtml(text)}</div>
</body>
</html>`;
}

module.exports = { speechBubbleHtml, statusBubbleHtml };
