function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function widgetHtml(timeStr, weatherStr) {
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
    .widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 4px 10px;
      background: rgba(20, 20, 20, 0.72);
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .time {
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 1px;
      line-height: 1.2;
    }
    .weather {
      font-size: 11px;
      color: rgba(255,255,255,0.55);
      line-height: 1.2;
    }
  </style>
</head>
<body>
  <div class="widget">
    <div class="time">${escapeHtml(timeStr)}</div>
    ${weatherStr ? `<div class="weather">${escapeHtml(weatherStr)}</div>` : ""}
  </div>
</body>
</html>`;
}

module.exports = { widgetHtml };
