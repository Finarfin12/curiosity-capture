import { draftFromPage, type Draft } from "./draft";

const menuId = "curiosity-capture";
const storagePrefix = "capture:";
const expiry = 30 * 60_000;

async function refreshMenu() {
  const settings = await chrome.storage.local.get("language");
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: menuId, title: settings.language === "id" ? "Tangkap untuk Curiosity Learning" : "Capture for Curiosity Learning",
    contexts: ["selection"],
  });
}

async function openCapture(draft: Draft) {
  const id = crypto.randomUUID();
  const started = Date.now();
  const pending = await chrome.storage.session.get(null) as Record<string, { started?: number }>;
  const captures = Object.entries(pending).filter(([key]) => key.startsWith(storagePrefix))
    .sort(([, a], [, b]) => (b.started ?? 0) - (a.started ?? 0));
  const remove = captures.filter(([, item], index) => index >= 19 || started - (item.started ?? 0) > expiry).map(([key]) => key);
  if (remove.length) await chrome.storage.session.remove(remove);
  await chrome.storage.session.set({ [storagePrefix + id]: { ...draft, started } });
  await chrome.windows.create({ url: chrome.runtime.getURL("capture.html?id=" + id),
    type: "popup", focused: true, width: 620, height: 770 });
}

async function captureActive(tab?: chrome.tabs.Tab) {
  const active = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  let selection = "";
  if (active?.id !== undefined) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: active.id }, func: () => window.getSelection()?.toString() ?? "",
      });
      selection = results[0]?.result ?? "";
    } catch { /* System pages have no script access. The form can be edited manually. */ }
  }
  await openCapture(draftFromPage(active?.title, active?.url, selection));
}

const report = () => console.warn("Curiosity Capture could not open or refresh its controls.");
chrome.runtime.onInstalled.addListener(() => { void refreshMenu().catch(report); });
chrome.runtime.onStartup.addListener(() => { void refreshMenu().catch(report); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.language) void refreshMenu().catch(report);
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === menuId) void openCapture(draftFromPage(tab?.title, tab?.url ?? info.pageUrl,
    info.selectionText)).catch(report);
});
chrome.commands.onCommand.addListener((name, tab) => {
  if (name === "capture-selection") void captureActive(tab).catch(report);
});
chrome.action.onClicked.addListener(tab => { void captureActive(tab).catch(report); });
