import { test, expect } from "@playwright/test";

test("home page loads and shows albums section", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "音乐" })).toBeVisible();

  // Either loading, empty state, or album grid content should appear.
  await expect(
    page
      .getByText("加载中...")
      .or(page.getByText("暂无专辑"))
      .or(page.locator('a[href^="/player/"]'))
      .first(),
  ).toBeVisible();
});

test("songs api responds", async ({ request }) => {
  const res = await request.get("/api/songs");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data).toHaveProperty("albums");
  expect(Array.isArray(data.albums)).toBeTruthy();
});
