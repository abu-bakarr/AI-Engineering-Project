(function () {
  var script = document.currentScript;
  if (!script) return;
  var botId = script.getAttribute("data-bot-id");
  if (!botId) return;
  var baseUrl = script.src.split("/widget.js")[0];

  var root = document.createElement("div");
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.top = "auto";
  root.style.left = "auto";
  root.style.zIndex = "2147483647";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.alignItems = "flex-end";
  document.body.appendChild(root);

  var button = document.createElement("button");
  button.style.width = "56px";
  button.style.height = "56px";
  button.style.borderRadius = "9999px";
  button.style.border = "none";
  button.style.color = "#fff";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 8px 24px rgba(0,0,0,.2)";
  root.appendChild(button);

  var panel = document.createElement("div");
  panel.style.display = "none";
  panel.style.width = "360px";
  panel.style.height = "520px";
  panel.style.background = "#fff";
  panel.style.borderRadius = "14px";
  panel.style.overflow = "hidden";
  panel.style.boxShadow = "0 12px 28px rgba(0,0,0,.2)";
  panel.style.marginBottom = "10px";
  panel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  root.insertBefore(panel, button);

  panel.innerHTML =
    '<div id="h" style="padding:12px 14px;color:#fff;font-weight:600">Assistant</div>' +
    '<div id="m" style="height:400px;overflow:auto;padding:10px;background:#f8fafc"></div>' +
    '<div style="display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb"><input id="i" placeholder="Ask a question..." style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:9px;color:#000;background:#fff"><button id="s" style="border:none;border-radius:8px;padding:9px 12px;color:#fff;cursor:pointer">Send</button></div>';

  var header = panel.querySelector("#h");
  var messages = panel.querySelector("#m");
  var input = panel.querySelector("#i");
  var send = panel.querySelector("#s");
  var accent = "#2563eb";
  var logoDataUrl = "";
  var botName = "Assistant";
  var typingNode = null;
  var isWaiting = false;

  function initials(name) {
    var parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "AI";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function renderButtonIcon(name) {
    button.innerHTML = "";
    if (logoDataUrl) {
      var img = document.createElement("img");
      img.src = logoDataUrl;
      img.alt = (name || "Assistant") + " logo";
      img.style.width = "56px";
      img.style.height = "56px";
      img.style.borderRadius = "9999px";
      img.style.objectFit = "cover";
      button.appendChild(img);
      return;
    }
    var label = document.createElement("span");
    label.textContent = initials(name);
    label.style.fontSize = "12px";
    label.style.fontWeight = "700";
    label.style.letterSpacing = "0.2px";
    button.appendChild(label);
  }

  function renderCitations(container, citations, latencyMs) {
    if (!Array.isArray(citations) || citations.length === 0) return;

    var meta = document.createElement("div");
    meta.style.marginTop = "8px";
    meta.style.display = "grid";
    meta.style.gap = "6px";

    var title = document.createElement("div");
    title.textContent = "Citations";
    title.style.fontSize = "11px";
    title.style.fontWeight = "600";
    title.style.textTransform = "uppercase";
    title.style.letterSpacing = "0.06em";
    title.style.color = "#64748b";
    meta.appendChild(title);

    citations.forEach(function (citation) {
      var item = document.createElement("div");
      item.style.border = "1px solid #cbd5e1";
      item.style.borderRadius = "10px";
      item.style.background = "#fff";
      item.style.padding = "8px 10px";

      var file = document.createElement("div");
      file.textContent = citation.fileName || "Unknown source";
      file.style.fontSize = "12px";
      file.style.fontWeight = "600";
      file.style.color = "#334155";
      item.appendChild(file);

      if (citation.snippet) {
        var snippet = document.createElement("div");
        snippet.textContent = citation.snippet;
        snippet.style.marginTop = "4px";
        snippet.style.fontSize = "12px";
        snippet.style.lineHeight = "1.45";
        snippet.style.color = "#64748b";
        item.appendChild(snippet);
      }

      meta.appendChild(item);
    });

    if (typeof latencyMs === "number") {
      var latency = document.createElement("div");
      latency.textContent = "Latency: " + latencyMs + " ms";
      latency.style.fontSize = "11px";
      latency.style.color = "#94a3b8";
      meta.appendChild(latency);
    }

    container.appendChild(meta);
  }

  function addMessage(who, text, options) {
    var wrap = document.createElement("div");
    wrap.style.margin = "0 0 10px";
    wrap.style.textAlign = who === "user" ? "right" : "left";
    var bubble = document.createElement("div");
    bubble.style.display = "inline-block";
    bubble.style.maxWidth = "85%";
    bubble.style.padding = "8px 10px";
    bubble.style.borderRadius = "10px";
    bubble.style.whiteSpace = "pre-wrap";
    bubble.style.fontSize = "13px";
    bubble.style.background = who === "user" ? accent : "#e2e8f0";
    bubble.style.color = who === "user" ? "#fff" : "#0f172a";
    bubble.textContent = text;
    wrap.appendChild(bubble);
    if (who === "bot" && options) {
      renderCitations(wrap, options.citations, options.latencyMs);
    }
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    return wrap;
  }

  function clearTypingMessage() {
    if (typingNode && typingNode.parentNode) {
      typingNode.parentNode.removeChild(typingNode);
    }
    typingNode = null;
  }

  function showTypingMessage() {
    clearTypingMessage();
    typingNode = addMessage("bot", botName + " is typing");
  }

  function setWaiting(waiting) {
    isWaiting = waiting;
    send.disabled = waiting;
    input.disabled = waiting;
    send.style.opacity = waiting ? "0.75" : "1";
    input.style.opacity = waiting ? "0.75" : "1";
  }

  button.onclick = function () {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  };
  renderButtonIcon("Assistant");

  function post() {
    var text = input.value.trim();
    if (!text || isWaiting) return;
    addMessage("user", text);
    input.value = "";
    setWaiting(true);
    showTypingMessage();
    fetch(baseUrl + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: botId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        clearTypingMessage();
        addMessage("bot", data.reply || data.error || "No response.", {
          citations: data.citations || [],
          latencyMs: data.latencyMs
        });
      })
      .catch(function () {
        clearTypingMessage();
        addMessage("bot", "Request failed. Try again.");
      })
      .finally(function () {
        setWaiting(false);
      });
  }

  send.onclick = post;
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") post();
  });

  fetch(baseUrl + "/api/widget/" + botId)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var bot = data.bot || {};
      accent = bot.accentColor || accent;
      logoDataUrl = bot.logoDataUrl || "";
      botName = bot.name || "Assistant";
      button.style.background = accent;
      header.style.background = accent;
      send.style.background = accent;
      header.textContent = botName;
      renderButtonIcon(botName);
      addMessage("bot", "Hi, ask me anything from my knowledge base.");
    })
    .catch(function () {
      button.style.background = accent;
      header.style.background = accent;
      send.style.background = accent;
      renderButtonIcon("Assistant");
    });
})();
  input.style.color = "#000";
  input.style.caretColor = "#000";
  input.style.background = "#fff";
