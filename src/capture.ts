import { captureMarkdown } from "./shared/captureMarkdown";
import { captureLimits, captureUri, MAX_CAPTURE_URI, validateCapture } from "./shared/captureValidator";
import { localDate } from "./shared/dates";
import type { Draft } from "./draft";

const en = {
  settings: "Settings", language: "Language", title: "Page title", url: "Source URL", selection: "Selected text",
  question: "What do I want to understand?", suggest: "Suggest a question", guess: "Prior guess (optional)",
  confidence: "Initial confidence", preview: "Preview", send: "Send to Obsidian", copy: "Copy Markdown",
  clipped: "A field exceeded its limit. Review the shortened text and supply a valid URL if it is blank.",
  incomplete: "Enter a safe title, an HTTP(S) URL, selected text, and a question.",
  tooLong: "This capture is too long for a link. Use Copy Markdown.",
  sent: "Sent to Obsidian. Confirm there to save it.",
  copied: "Markdown copied. In Obsidian, run Import capture Markdown to review and save it.",
  copyFailed: "Clipboard unavailable. Open Preview to select and copy the Markdown.",
};
const id: typeof en = {
  settings: "Pengaturan", language: "Bahasa", title: "Judul halaman", url: "URL sumber", selection: "Kutipan terpilih",
  question: "Apa yang ingin kupahami?", suggest: "Sarankan pertanyaan", guess: "Dugaan awal (opsional)",
  confidence: "Keyakinan awal", preview: "Pratinjau", send: "Kirim ke Obsidian", copy: "Salin Markdown",
  clipped: "Ada kolom melebihi batas. Periksa teks yang dipotong dan isi URL jika kosong.",
  incomplete: "Isi judul yang aman, URL HTTP(S), kutipan, dan pertanyaan.",
  tooLong: "Tangkapan terlalu panjang untuk tautan. Gunakan Salin Markdown.",
  sent: "Dikirim ke Obsidian. Konfirmasi di sana untuk menyimpan.",
  copied: "Markdown disalin. Jalankan Impor Markdown tangkapan di Obsidian untuk meninjau dan menyimpan.",
  copyFailed: "Papan klip tidak dapat digunakan. Buka Pratinjau untuk memilih dan menyalin Markdown.",
};
const prompts = {
  en: ["What mechanism explains this?", "When does this idea stop applying?", "How could I test this on a new example?"],
  id: ["Mekanisme apa yang menjelaskan ini?", "Kapan gagasan ini berhenti berlaku?", "Bagaimana cara mengujinya pada contoh baru?"],
};
type Language = "id" | "en";
type TextKey = keyof Omit<typeof import("./shared/captureValidator").captureLimits, "capture_id">;
type TextControl = HTMLInputElement | HTMLTextAreaElement;
const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const controls: Record<TextKey, TextControl> = {
  title: get("#title"), url: get("#url"), selection: get("#selection"), question: get("#question"), prior_guess: get("#prior_guess"),
};
const language = get<HTMLSelectElement>("#language");
const confidence = get<HTMLSelectElement>("#confidence");
const status = get("#status");
const submit = get<HTMLAnchorElement>("#send");
const preview = get("#preview");
const copy = get<HTMLButtonElement>("#copy");
const clipped = get("#clipped");
const form = get<HTMLFormElement>("form");
const idQuery = new URLSearchParams(location.search).get("id") ?? "";
const captureId = /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(idQuery) ? idQuery : crypto.randomUUID();
let lang: Language = "en";
let tr = en;
let promptIndex = 0;
let wasClipped = false;
let latest: { markdown: string; uri: string } | undefined;

function update() {
  for (const [name, control] of Object.entries(controls) as [TextKey, TextControl][]) {
    const label = document.querySelector<HTMLLabelElement>('label[for="' + name + '"]');
    if (label) label.textContent = tr[name === "prior_guess" ? "guess" : name] + " · " + control.value.length + "/" + captureLimits[name];
  }
  const raw = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
  const capture = validateCapture({ v: "1", capture_id: captureId, ...raw, confidence: confidence.value });
  latest = capture ? { markdown: captureMarkdown(capture, localDate(), captureId), uri: captureUri(capture) } : undefined;
  preview.textContent = latest?.markdown ?? tr.incomplete;
  const ready = Boolean(latest && latest.uri.length <= MAX_CAPTURE_URI);
  if (ready && latest) submit.href = latest.uri;
  else submit.removeAttribute("href");
  submit.setAttribute("aria-disabled", String(!ready));
  copy.disabled = !latest;
  status.textContent = !latest ? tr.incomplete : ready ? "" : tr.tooLong;
}

function setLanguage(value: Language) {
  lang = value;
  tr = lang === "id" ? id : en;
  document.documentElement.lang = lang;
  language.value = lang;
  document.querySelectorAll<HTMLElement>("[data-label]").forEach(el => {
    const key = el.dataset.label as keyof typeof en;
    el.textContent = tr[key];
  });
  clipped.textContent = tr.clipped;
  clipped.hidden = !wasClipped;
  update();
}

for (const [key, field] of Object.entries(controls) as [TextKey, TextControl][]) field.maxLength = captureLimits[key];
form.addEventListener("input", update);
form.addEventListener("submit", event => event.preventDefault());
language.addEventListener("change", () => {
  setLanguage(language.value === "id" ? "id" : "en");
  void chrome.storage.local.set({ language: lang }).catch(() => undefined);
});
get<HTMLButtonElement>("#suggest").addEventListener("click", () => {
  const bank = prompts[lang];
  controls.question.value = bank[promptIndex++ % bank.length];
  controls.question.focus();
  update();
});
submit.addEventListener("click", event => {
  if (!latest || latest.uri.length > MAX_CAPTURE_URI) { event.preventDefault(); return; }
  status.textContent = tr.sent;
});
submit.addEventListener("keydown", event => {
  if (event.key === " " && latest && latest.uri.length <= MAX_CAPTURE_URI) { event.preventDefault(); submit.click(); }
});
copy.addEventListener("click", () => {
  if (!latest) return;
  void navigator.clipboard.writeText(latest.markdown)
    .then(() => { status.textContent = tr.copied; })
    .catch(() => { status.textContent = tr.copyFailed; });
});

async function initialize() {
  const storageKey = "capture:" + captureId;
  const [persisted, session] = await Promise.all([
    chrome.storage.local.get("language"), chrome.storage.session.get(storageKey),
  ]);
  const draft = session[storageKey] as (Draft & { started?: number }) | undefined;
  if (draft?.started && Date.now() - draft.started <= 30 * 60_000) {
    for (const key of ["title", "url", "selection"] as const) controls[key].value = draft[key];
    wasClipped = draft.truncated;
  }
  setLanguage(persisted.language === "id" ? "id" : "en");
  controls.question.focus();
}
setLanguage("en");
void initialize().catch(() => undefined);
