import { beforeEach, expect, it, vi } from "vitest";
const technologies = vi.hoisted(() => vi.fn());
vi.mock("../src/server/services", () => ({
  services: () => ({ feed: { technologies } }),
}));
import { GET } from "../src/app/api/v1/technologies/route";
beforeEach(() => {
  technologies.mockReset();
});

it("passes database search and pagination to the repository and returns its cursor", async () => {
  const page = {
    data: [{ value: "node-js", label: "Node.js" }],
    next_after: "node-js",
  };
  technologies.mockResolvedValue(page);
  const response = await GET(
    new Request(
      "https://feed.test/api/v1/technologies?q=Node.js&after=java&limit=10",
    ),
  );
  expect(technologies).toHaveBeenCalledExactlyOnceWith({
    q: "Node.js",
    after: "java",
    limit: 10,
  });
  expect(await response.json()).toEqual(page);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("defaults to twenty suggestions and reports an exhausted result", async () => {
  technologies.mockResolvedValue({ data: [], next_after: null });
  const response = await GET(
    new Request("https://feed.test/api/v1/technologies"),
  );
  expect(technologies).toHaveBeenCalledExactlyOnceWith({
    q: "",
    after: undefined,
    limit: 20,
  });
  expect(await response.json()).toEqual({ data: [], next_after: null });
});
it.each([
  "limit=0",
  "limit=101",
  "limit=1.5",
  "limit=",
  "limit=1&limit=2",
  "after=",
  "after=a&after=b",
  "after=Node.js",
  "after=" + "a".repeat(101),
  "q=!!!",
  "q=a&q=b",
  "q=" + "a".repeat(101),
  "unknown=1",
])("rejects invalid technology parameters: %s", async (query) => {
  const response = await GET(
    new Request("https://feed.test/api/v1/technologies?" + query),
  );
  expect(response.status).toBe(400);
  expect(technologies).not.toHaveBeenCalled();
});
it("reports a database outage without returning an empty successful page", async () => {
  technologies.mockRejectedValue(new Error("database unavailable"));
  const response = await GET(
    new Request("https://feed.test/api/v1/technologies"),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("retry-after")).toBe("60");
});
