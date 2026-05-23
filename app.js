const STORAGE_KEY = "aluetoo-conversations-v1";
const THEME_KEY = "aluetoo-theme";

const form = document.getElementById("chatForm");
const input = document.getElementById("promptInput");
const messagesEl = document.getElementById("messages");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const suggestionButtons = document.querySelectorAll(".suggestion-card");
const welcomePanel = document.getElementById("welcomePanel");
const menuBtn = document.getElementById("menuBtn");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");
const backdrop = document.getElementById("backdrop");
const themeBtn = document.getElementById("themeBtn");
const historyList = document.getElementById("historyList");
const conversationTitle = document.getElementById("conversationTitle");
const modelSelect = document.getElementById("modelSelect");
const attachBtn = document.getElementById("attachBtn");
const attachMenu = document.getElementById("attachMenu");
const fileInput = document.getElementById("fileInput");
const micBtn = document.getElementById("micBtn");
const attachmentsStrip = document.getElementById("attachmentsStrip");
const composerHint = document.getElementById("composerHint");
const welcomeGreeting = document.getElementById("welcomeGreeting");
const attachOptions = document.querySelectorAll(".attach-option");

let busy = false;
let conversations = [];
let currentConversationId = null;
let pendingAttachments = [];
let recognition = null;
let recording = false;
let pendingFileAccept = "image/*,video/*,.pdf";
let availableModels = [
  { alias: "flash", label: "Aluetoo Flash" },
  { alias: "pro", label: "Aluetoo Pro" },
  { alias: "vision", label: "Aluetoo Vision" },
];

const themeOrder = ["auto", "dark", "light"];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function autoResize() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  sendBtn.disabled = nextBusy;
  modelSelect.disabled = nextBusy;
  sendBtn.textContent = "↑";
}

function toggleWelcome() {
  const conversation = getCurrentConversation();
  welcomePanel.hidden = Boolean(conversation && conversation.messages.length > 0);
}

function updateGreeting() {
  const hour = new Date().getHours();
  welcomeGreeting.textContent =
    hour >= 18 || hour < 5
      ? "Bonsoir, comment puis-je vous aider ?"
      : "Bonjour, comment puis-je vous aider ?";
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function closeAttachMenu() {
  attachMenu.classList.remove("open");
  window.setTimeout(() => {
    if (!attachMenu.classList.contains("open")) {
      attachMenu.hidden = true;
    }
  }, 180);
}

function openAttachMenu() {
  attachMenu.hidden = false;
  requestAnimationFrame(() => {
    attachMenu.classList.add("open");
  });
}

function toggleAttachMenu() {
  if (attachMenu.classList.contains("open")) {
    closeAttachMenu();
  } else {
    openAttachMenu();
  }
}

function openSidebar() {
  document.body.classList.add("sidebar-open");
}

function scrollMessages() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function applyTheme(mode) {
  const nextMode = themeOrder.includes(mode) ? mode : "auto";
  const root = document.documentElement;

  if (nextMode === "auto") {
    root.removeAttribute("data-theme");
    localStorage.removeItem(THEME_KEY);
  } else {
    root.setAttribute("data-theme", nextMode);
    localStorage.setItem(THEME_KEY, nextMode);
  }

  themeBtn.textContent = `Theme: ${nextMode === "auto" ? "Auto" : nextMode === "dark" ? "Sombre" : "Clair"}`;
}

function cycleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "auto";
  const index = themeOrder.indexOf(current);
  applyTheme(themeOrder[(index + 1) % themeOrder.length]);
}

function restoreTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "auto");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(markdown) {
  const safe = escapeHtml(markdown).replace(/\r/g, "");
  const codeBlocks = [];

  const withCodeBlocks = safe.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code class="lang-${lang || "plain"}">${code}</code></pre>`);
    return token;
  });

  const blocks = withCodeBlocks.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const rendered = blocks
    .map((block) => {
      if (/^__CODE_BLOCK_\d+__$/.test(block)) {
        return block;
      }

      if (/^>\s?/.test(block)) {
        return `<blockquote>${renderInlineMarkdown(block.replace(/^>\s?/gm, "").replace(/\n/g, "<br>"))}</blockquote>`;
      }

      if (block.includes("\n") && block.split("\n").every((line) => line.includes("|"))) {
        const lines = block.split("\n").filter(Boolean);
        if (lines.length >= 2) {
          const headerCells = lines[0]
            .split("|")
            .map((cell) => cell.trim())
            .filter(Boolean)
            .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
            .join("");

          const bodyRows = lines
            .slice(2)
            .map((row) => {
              const cells = row
                .split("|")
                .map((cell) => cell.trim())
                .filter(Boolean)
                .map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`)
                .join("");
              return `<tr>${cells}</tr>`;
            })
            .join("");

          return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
        }
      }

      if (/^\-\s+/m.test(block)) {
        const items = block
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => line.replace(/^\-\s+/, "").trim())
          .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      if (/^\d+\.\s+/m.test(block)) {
        const items = block
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => line.replace(/^\d+\.\s+/, "").trim())
          .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }

      if (/^#{1,3}\s/.test(block)) {
        const [, hashes, content] = block.match(/^(#{1,3})\s+([\s\S]+)$/) || [];
        const level = Math.min((hashes || "#").length + 2, 6);
        return `<h${level}>${renderInlineMarkdown((content || "").replace(/\n/g, "<br>"))}</h${level}>`;
      }

      return `<p>${renderInlineMarkdown(block.replace(/\n/g, "<br>"))}</p>`;
    })
    .join("");

  return rendered.replace(/__CODE_BLOCK_(\d+)__/g, (_match, index) => codeBlocks[Number(index)] || "");
}

function summarizeTitle(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Nouvelle conversation";
  }
  return normalized.length > 34 ? `${normalized.slice(0, 34).trim()}...` : normalized;
}

function formatHistoryDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "2-digit",
  });
}

function saveConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

function loadConversations() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) {
      conversations = parsed;
    }
  } catch (_error) {
    conversations = [];
  }
}

function getCurrentConversation() {
  return conversations.find((conversation) => conversation.id === currentConversationId) || null;
}

function ensureConversation() {
  let conversation = getCurrentConversation();

  if (conversation) {
    return conversation;
  }

  conversation = {
    id: uid(),
    title: "Nouvelle conversation",
    modelAlias: modelSelect.value || "flash",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  conversations.unshift(conversation);
  currentConversationId = conversation.id;
  saveConversations();
  return conversation;
}

function updateConversationTitle() {
  const conversation = getCurrentConversation();
  if (!conversation) {
    conversationTitle.textContent = "Nouvelle conversation";
    return;
  }

  conversationTitle.textContent = conversation.title;
}

function updateConversationModel(alias) {
  const conversation = ensureConversation();
  conversation.modelAlias = alias;
  conversation.updatedAt = new Date().toISOString();
  saveConversations();
  renderHistory();
}

function reorderConversations(activeId) {
  conversations.sort((a, b) => {
    if (a.id === activeId) {
      return -1;
    }
    if (b.id === activeId) {
      return 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function renderHistory() {
  historyList.innerHTML = "";

  if (conversations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.innerHTML = `<span class="history-title">Aucune conversation</span>`;
    historyList.append(empty);
    return;
  }

  conversations.forEach((conversation) => {
    const item = document.createElement("button");
    item.className = `history-item ${conversation.id === currentConversationId ? "active" : ""}`;
    item.type = "button";

    const modelLabel = availableModels.find((model) => model.alias === conversation.modelAlias)?.label || "Aluetoo";
    const shortModel = modelLabel.replace("Aluetoo ", "");

    item.innerHTML = `
      <span>
        <span class="history-title">${escapeHtml(conversation.title)}</span>
        <span class="history-date">${formatHistoryDate(conversation.updatedAt)}</span>
      </span>
      <span class="history-model">${shortModel}</span>
    `;

    item.addEventListener("click", () => {
      currentConversationId = conversation.id;
      modelSelect.value = conversation.modelAlias || "flash";
      renderConversation();
      renderHistory();
      closeSidebar();
    });

    historyList.append(item);
  });
}

function createMessageElement(role, content = "", options = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const body = document.createElement("div");
  body.className = role === "assistant" ? "message-body glass" : "message-body";

  const roleLabel = document.createElement("p");
  roleLabel.className = "message-role";
  roleLabel.textContent = role === "assistant" ? "Aluetoo AI" : "Toi";

  const text = document.createElement("div");
  text.className = "message-content";

  if (role === "assistant") {
    text.innerHTML = renderMarkdown(content);
  } else {
    text.innerHTML = `<p>${escapeHtml(content).replace(/\n/g, "<br>")}</p>`;
  }

  body.append(roleLabel, text);

  if (Array.isArray(options.attachments) && options.attachments.length > 0) {
    const attachmentList = document.createElement("div");
    attachmentList.className = "attachment-list";

    options.attachments.forEach((attachment) => {
      const card = document.createElement("div");
      card.className = "attachment-card";

      if (attachment.kind === "image" && attachment.previewUrl) {
        card.innerHTML = `<img src="${attachment.previewUrl}" alt="${escapeHtml(attachment.name)}" />`;
      } else if (attachment.kind === "video" && attachment.previewUrl) {
        card.innerHTML = `<video src="${attachment.previewUrl}" controls muted playsinline></video>`;
      } else if (attachment.kind === "pdf" && attachment.previewUrl) {
        card.innerHTML = `<iframe src="${attachment.previewUrl}" title="${escapeHtml(attachment.name)}"></iframe>`;
      } else {
        card.innerHTML = `<div class="pdf-chip">Fichier</div>`;
      }

      const caption = document.createElement("span");
      caption.className = "attachment-caption";
      caption.textContent = attachment.name;
      card.append(caption);
      attachmentList.append(card);
    });

    body.append(attachmentList);
  }

  message.append(body);
  messagesEl.append(message);
  scrollMessages();

  return { message, body, text };
}

function createAssistantShell() {
  const shell = createMessageElement("assistant", "");
  shell.text.classList.add("typing-caret");

  const meta = document.createElement("div");
  meta.className = "assistant-meta";

  const activity = document.createElement("section");
  activity.className = "activity-box";
  activity.innerHTML = `
    <p class="activity-label">Activite</p>
    <div class="activity-pill">
      <span class="activity-dot"></span>
      <span class="activity-text">Preparation...</span>
    </div>
  `;

  const sources = document.createElement("section");
  sources.className = "sources-box";
  sources.hidden = true;
  sources.innerHTML = `
    <div class="source-head">
      <p class="activity-label">Sources</p>
      <p class="source-caption">References utiles</p>
    </div>
    <div class="sources-list"></div>
  `;

  meta.append(activity, sources);
  shell.body.append(meta);
  scrollMessages();

  return {
    ...shell,
    activityText: activity.querySelector(".activity-text"),
    sourcesBox: sources,
    sourcesList: sources.querySelector(".sources-list"),
  };
}

function renderSources(container, sources) {
  container.sourcesList.innerHTML = "";

  if (!Array.isArray(sources) || sources.length === 0) {
    container.sourcesBox.hidden = true;
    return;
  }

  sources.forEach((source, index) => {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `
      <span class="source-index">${index + 1}</span>
      <span>
        <span class="source-title">${escapeHtml(source.title)}</span>
        <span class="source-url">${escapeHtml(source.url)}</span>
      </span>
    `;
    container.sourcesList.append(link);
  });

  container.sourcesBox.hidden = false;
}

function renderComposerAttachments() {
  attachmentsStrip.innerHTML = "";
  attachmentsStrip.hidden = pendingAttachments.length === 0;

  pendingAttachments.forEach((attachment) => {
    const card = document.createElement("div");
    card.className = "composer-attachment";

    let media = `<div class="pdf-chip">${attachment.kind.toUpperCase()}</div>`;

    if (attachment.kind === "image") {
      media = `<img src="${attachment.previewUrl}" alt="${escapeHtml(attachment.name)}" />`;
    } else if (attachment.kind === "video") {
      media = `<video src="${attachment.previewUrl}" muted playsinline></video>`;
    } else if (attachment.kind === "pdf") {
      media = `<div class="pdf-chip">PDF</div>`;
    }

    card.innerHTML = `
      ${media}
      <button class="remove-attachment" type="button" aria-label="Retirer le fichier">×</button>
      <span class="composer-attachment-name">${escapeHtml(attachment.name)}</span>
    `;

    card.querySelector(".remove-attachment").addEventListener("click", () => {
      pendingAttachments = pendingAttachments.filter((item) => item.id !== attachment.id);
      renderComposerAttachments();
    });

    attachmentsStrip.append(card);
  });
}

function resetComposer() {
  input.value = "";
  pendingAttachments = [];
  autoResize();
  renderComposerAttachments();
}

function renderConversation() {
  messagesEl.innerHTML = "";
  const conversation = getCurrentConversation();

  if (conversation && conversation.messages.length > 0) {
    conversation.messages.forEach((message) => {
      createMessageElement(message.role, message.content, {
        attachments: message.attachments || [],
      });

      if (message.role === "assistant") {
        const lastMessage = messagesEl.lastElementChild?.querySelector(".message-body");
        if (lastMessage && Array.isArray(message.sources) && message.sources.length > 0) {
          const metaWrap = document.createElement("div");
          metaWrap.className = "assistant-meta";
          const sourceBox = document.createElement("section");
          sourceBox.className = "sources-box";
          sourceBox.innerHTML = `
            <div class="source-head">
              <p class="activity-label">Sources</p>
              <p class="source-caption">References utiles</p>
            </div>
            <div class="sources-list"></div>
          `;
          metaWrap.append(sourceBox);
          lastMessage.append(metaWrap);

          const container = {
            sourcesBox: sourceBox,
            sourcesList: sourceBox.querySelector(".sources-list"),
          };
          renderSources(container, message.sources);
        }
      }
    });
  }

  updateConversationTitle();
  toggleWelcome();
  scrollMessages();
}

function resetChat() {
  currentConversationId = null;
  modelSelect.value = "flash";
  resetComposer();
  renderConversation();
  renderHistory();
  closeSidebar();
}

function hydrateModels(models) {
  if (!Array.isArray(models) || models.length === 0) {
    return;
  }

  availableModels = models;
  modelSelect.innerHTML = models
    .map((model) => `<option value="${model.alias}">${model.label}</option>`)
    .join("");
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    hydrateModels(data.models);

    const activeConversation = getCurrentConversation();
    if (activeConversation?.modelAlias) {
      modelSelect.value = activeConversation.modelAlias;
    } else if (data.defaultModelAlias) {
      modelSelect.value = data.defaultModelAlias;
    }
  } catch (_error) {
    composerHint.textContent = "Connexion du serveur indisponible";
  }
}

function attachFiles(fileList) {
  const files = Array.from(fileList || []);

  files.forEach((file) => {
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type === "application/pdf"
          ? "pdf"
          : "file";

    pendingAttachments.push({
      id: uid(),
      name: file.name,
      kind,
      previewUrl: URL.createObjectURL(file),
      type: file.type,
      dataUrl: null,
    });
  });

  renderComposerAttachments();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function attachFilesAsync(fileList) {
  const files = Array.from(fileList || []);

  for (const file of files) {
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type === "application/pdf"
          ? "pdf"
          : "file";

    pendingAttachments.push({
      id: uid(),
      name: file.name,
      kind,
      previewUrl: URL.createObjectURL(file),
      type: file.type,
      dataUrl: kind === "image" ? await fileToDataUrl(file) : null,
    });
  }

  renderComposerAttachments();
}

function maybeInitRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    composerHint.textContent = "Micro indisponible dans ce navigateur";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    recording = true;
    micBtn.textContent = "Stop";
    composerHint.textContent = "Ecoute en cours...";
  };

  recognition.onend = () => {
    recording = false;
    micBtn.textContent = "Mic";
    composerHint.textContent = "Entree pour envoyer";
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ");

    input.value = transcript.trim();
    autoResize();
  };
}

function toggleMicrophone() {
  if (!recognition) {
    return;
  }

  if (recording) {
    recognition.stop();
  } else {
    closeAttachMenu();
    recognition.start();
  }
}

async function streamResponse(assistantMessageEl, conversation, attachments) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelAlias: conversation.modelAlias,
      messages: conversation.messages.map(({ role, content }) => ({ role, content })),
      attachments,
    }),
  });

  if (!response.ok || !response.body) {
    let message = "Unknown error";

    try {
      const data = await response.json();
      message = data.error || message;
    } catch (_error) {
      message = "Unable to read the server response.";
    }

    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  let finalSources = [];

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const event = JSON.parse(line);

      if (event.type === "stage") {
        assistantMessageEl.activityText.textContent = event.stage;
      }

      if (event.type === "chunk") {
        finalText += event.content;
        assistantMessageEl.text.innerHTML = renderMarkdown(finalText);
        scrollMessages();
      }

      if (event.type === "done") {
        finalText = event.content || finalText.trim();
        finalSources = event.sources || [];
        assistantMessageEl.text.classList.remove("typing-caret");
        assistantMessageEl.text.innerHTML = renderMarkdown(finalText);
        assistantMessageEl.activityText.textContent =
          finalSources.length > 0 ? "Reponse terminee avec sources" : "Reponse terminee";
        renderSources(assistantMessageEl, finalSources);
      }

      if (event.type === "error") {
        throw new Error(event.error || "Streaming failed");
      }
    }

    if (done) {
      break;
    }
  }

  return {
    content: finalText.trim(),
    sources: finalSources,
  };
}

async function submitPrompt(prompt) {
  if ((!prompt && pendingAttachments.length === 0) || busy) {
    return;
  }

  const conversation = ensureConversation();
  conversation.modelAlias = modelSelect.value;

  const userMessage = {
    role: "user",
    content: prompt || "Fichiers joints",
    attachments: pendingAttachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      previewUrl: attachment.previewUrl,
      type: attachment.type,
    })),
  };

  createMessageElement("user", userMessage.content, { attachments: userMessage.attachments });
  conversation.messages.push(userMessage);

  if (conversation.title === "Nouvelle conversation") {
    conversation.title = summarizeTitle(prompt || pendingAttachments[0]?.name || "Nouvelle conversation");
  }

  conversation.updatedAt = new Date().toISOString();
  reorderConversations(conversation.id);
  saveConversations();
  renderHistory();
  updateConversationTitle();

  const attachmentsForRequest = pendingAttachments.map((attachment) => ({
    name: attachment.name,
    kind: attachment.kind,
    type: attachment.type,
    dataUrl: attachment.dataUrl || null,
  }));

  resetComposer();
  toggleWelcome();
  closeSidebar();
  setBusy(true);

  const assistantShell = createAssistantShell();

  try {
    const assistantReply = await streamResponse(assistantShell, conversation, attachmentsForRequest);
    conversation.messages.push({
      role: "assistant",
      content: assistantReply.content,
      sources: assistantReply.sources,
    });
    conversation.updatedAt = new Date().toISOString();
    reorderConversations(conversation.id);
    saveConversations();
    renderHistory();
  } catch (error) {
    assistantShell.text.classList.remove("typing-caret");
    assistantShell.text.innerHTML = `<p>Erreur: ${escapeHtml(error.message)}</p>`;
    assistantShell.activityText.textContent = "Echec de la reponse";
  } finally {
    setBusy(false);
    scrollMessages();
  }
}

function bootstrapConversationState() {
  loadConversations();

  if (conversations.length > 0) {
    currentConversationId = conversations[0].id;
    modelSelect.value = conversations[0].modelAlias || "flash";
  }

  renderHistory();
  renderConversation();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitPrompt(input.value.trim());
});

input.addEventListener("input", autoResize);
input.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await submitPrompt(input.value.trim());
  }
});

newChatBtn.addEventListener("click", resetChat);
menuBtn.addEventListener("click", openSidebar);
closeDrawerBtn.addEventListener("click", closeSidebar);
backdrop.addEventListener("click", closeSidebar);
themeBtn.addEventListener("click", cycleTheme);
attachBtn.addEventListener("click", toggleAttachMenu);
fileInput.addEventListener("change", async (event) => {
  await attachFilesAsync(event.target.files);
  fileInput.value = "";
});
micBtn.addEventListener("click", toggleMicrophone);
modelSelect.addEventListener("change", () => updateConversationModel(modelSelect.value));
attachOptions.forEach((option) => {
  option.addEventListener("click", () => {
    const kind = option.dataset.kind || "image";
    pendingFileAccept =
      kind === "image" ? "image/*" : kind === "video" ? "video/*" : ".pdf,application/pdf";
    fileInput.accept = pendingFileAccept;
    closeAttachMenu();
    fileInput.click();
  });
});

document.addEventListener("click", (event) => {
  if (!attachMenu.contains(event.target) && event.target !== attachBtn) {
    closeAttachMenu();
  }
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await submitPrompt(button.dataset.prompt || "");
  });
});

restoreTheme();
autoResize();
bootstrapConversationState();
updateGreeting();
toggleWelcome();
maybeInitRecognition();
checkHealth();
