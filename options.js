document.addEventListener("DOMContentLoaded", () => {
  const enableGemini = document.getElementById("enable-gemini");
  const enableChatGPT = document.getElementById("enable-chatgpt");
  const enableClaude = document.getElementById("enable-claude");
  const modifierSelect = document.getElementById("queue-modifier");
  const saveBtn = document.getElementById("save-btn");
  const status = document.getElementById("status");

  // Load saved settings
  chrome.storage.sync.get(
    {
      enableGemini: true,
      enableChatGPT: true,
      enableClaude: true,
      queueModifier: "",
    },
    (data) => {
      enableGemini.checked = data.enableGemini;
      enableChatGPT.checked = data.enableChatGPT;
      enableClaude.checked = data.enableClaude;
      modifierSelect.value = data.queueModifier || "";
    }
  );

  // Save
  saveBtn.addEventListener("click", () => {
    chrome.storage.sync.set(
      {
        enableGemini: enableGemini.checked,
        enableChatGPT: enableChatGPT.checked,
        enableClaude: enableClaude.checked,
        queueModifier: modifierSelect.value,
      },
      () => {
        status.textContent = "Saved!";
        setTimeout(() => {
          status.textContent = "";
        }, 2000);
      }
    );
  });
});
