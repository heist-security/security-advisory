import { test, expect } from "./test";

test("identical feed requests see publications, empty cursor updates and outages", async ({
  request,
}, info) => {
  test.setTimeout(60_000);
  const source = `fixture-live-${info.project.name}`;
  const control = (state: string) =>
    request.post(
      `http://127.0.0.1:3038/__test/live?source=${source}&state=${state}`,
    );
  const json = `/api/v1/events?source=${source}&limit=100`;
  const cursor = `${json}&after=101`;
  const rss = `/feed.xml?source=${source}`;
  await control("initial");
  expect((await (await request.get(json)).json()).data[0].id).toBe(101);
  expect((await (await request.get(cursor)).json()).data).toEqual([]);
  expect(await (await request.get(rss)).text()).toContain("heist-event:101");
  const html = `/?source=${source}`;
  expect(await (await request.get(html)).text()).toContain('id="event-101"');

  // The URLs must stay identical: changing limit/query would hide the stale-cache bug.
  await control("published");
  const latest = await request.get(json);
  const incremental = await request.get(cursor);
  const updatedRss = await request.get(rss);
  expect
    .soft((await latest.json()).data.map((e: { id: number }) => e.id))
    .toEqual([102, 101]);
  const body = await incremental.json();
  expect.soft(body.data.map((e: { id: number }) => e.id)).toEqual([102]);
  expect.soft(body.next_after).toBe(102);
  expect.soft(await updatedRss.text()).toContain("heist-event:102");
  expect
    .soft(await (await request.get(html)).text())
    .toContain('id="event-102"');
  for (const response of [latest, incremental, updatedRss])
    expect.soft(response.headers()["cache-control"]).toBe("no-store");

  await control("unavailable");
  for (const path of [json, cursor, rss]) {
    const response = await request.get(path);
    expect.soft(response.status()).toBe(503);
    expect.soft(response.headers()["cache-control"]).toBe("no-store");
  }
  expect
    .soft(await (await request.get(html)).text())
    .toContain("Feed temporarily unavailable");
  await control("published");
  expect((await (await request.get(cursor)).json()).data[0].id).toBe(102);
});
