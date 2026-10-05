import { afterEach, expect, it, vi } from "vitest";
import { searchImages } from "../src/services/imageSearch";
afterEach(() => vi.unstubAllGlobals());
it("requires the server key", async () => {
  await expect(searchImages("bank", "river bank", { GEMINI_MODEL: "test" })).rejects.toMatchObject({ status: 503 });
});
it("uses AI meaning context and returns only trusted image sources", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ query: "river bank landscape" }) }] } }] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: {
      1: { title: "File:River.jpg", imageinfo: [{ thumburl: "https://upload.wikimedia.org/river.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:River.jpg", extmetadata: { Artist: { value: "<b>Author</b>" }, LicenseShortName: { value: "CC BY" } } }] },
      2: { title: "unsafe", imageinfo: [{ url: "http://localhost/private" }] }
    } } })));
  vi.stubGlobal("fetch", fetch);
  const result = await searchImages("bank", "river bank", { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test" });
  expect(result.images).toHaveLength(1);
  expect(result.images[0].artist).toBe("Author");
  expect(fetch.mock.calls[1][0]).toContain("river+bank+landscape");
});
it("reports AI quota errors without searching images", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
  vi.stubGlobal("fetch", fetch);
  await expect(searchImages("apple", "fruit", { GEMINI_API_KEY: "test", GEMINI_MODEL: "test" })).rejects.toMatchObject({ status: 429 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
