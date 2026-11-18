import { captureLimits } from "./shared/captureValidator";
export type Draft = { title: string; url: string; selection: string; truncated: boolean };
const limit = (text: string, length: number) => text.slice(0, length).replace(/[\uD800-\uDBFF]$/, "");

export function draftFromPage(title = "", url = "", selection = ""): Draft {
  const cleanTitle = title.replace(/[/\\]+/g, " ").replace(/\.{2,}/g, "…");
  return { title: limit(cleanTitle, captureLimits.title),
    url: url.length <= captureLimits.url ? url : "",
    selection: limit(selection, captureLimits.selection),
    truncated: title.length > captureLimits.title || url.length > captureLimits.url || selection.length > captureLimits.selection };
}
