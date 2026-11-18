import { expect, test } from "vitest";
import { draftFromPage } from "../src/draft";
import { captureMarkdown, parseCaptureMarkdown } from "../src/shared/captureMarkdown";
import { captureLimits, captureUri, MAX_CAPTURE_URI, validateCapture } from "../src/shared/captureValidator";
import { readTopic } from "../src/shared/frontmatter";

const input = { v: "1", capture_id: "round-trip", title: "Source page", url: "https://example.com/article?part=a&n=2",
  selection: "One & two 🧠", question: "How does this work?", prior_guess: "", confidence: "70" };

test("KT-10: URI uses the versioned Curiosity action and percent-encodes all fields", () => {
  const capture = validateCapture(input)!;
  const uri = new URL(captureUri(capture));
  expect(uri.protocol).toBe("obsidian:");
  expect(uri.hostname).toBe("curiosity-capture");
  expect(Object.fromEntries(uri.searchParams)).toEqual(input);
});

test("KT-10: validates the same field limits and unsafe captures as the receiver", () => {
  for (const bad of [{ capture_id: ".." }, { title: "folder\\page" }, { url: "javascript:alert(1)" },
    { title: "<script>x</script>" }, { selection: "x".repeat(captureLimits.selection + 1) }, { question: "" },
    { question: "a\u0000b" }, { url: "https://example.com/%2e%2e%2fprivate" }]) {
    expect(validateCapture({ ...input, ...bad })).toBeNull();
  }
});

test("KT-10: oversize encoded URI keeps a complete Markdown fallback", () => {
  const capture = validateCapture({ ...input, selection: "界".repeat(2500) })!;
  expect(captureUri(capture).length).toBeGreaterThan(MAX_CAPTURE_URI);
  const fallback = captureMarkdown(capture, "2026-11-19", "capture-note");
  expect(readTopic(fallback)?.topic.cl_schema).toBe(1);
  expect(readTopic(fallback)?.topic.cl_kind).toBe("learning");
  expect(parseCaptureMarkdown(fallback)).toEqual(capture);
});

test("KT-10: drafts clip text without splitting surrogate pairs and indicate omissions", () => {
  const draft = draftFromPage("A/B..page", "https://example.com/" + "x".repeat(1000), "x".repeat(2499) + "🧠");
  expect(draft).toMatchObject({ title: "A B…page", url: "", truncated: true });
  expect(draft.selection).toBe("x".repeat(2499));
});
