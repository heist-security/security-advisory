import { expect, it } from "vitest";
import { parseFeedQuery } from "../src/presentation/filters";
import {
  technologyFamily,
  matchingTechnologyFamilies,
} from "../src/domain/technology";

it("groups known runtime versions and aliases but preserves distinct dependencies", () => {
  for (const value of [
    "Node.js",
    "node",
    "nodejs",
    "Node.js 6",
    "Node.js v22.14.0",
    "nodejs-100-lts",
  ])
    expect(technologyFamily(value)).toBe("node-js");
  expect(technologyFamily("CPython 3.13")).toBe("python");
  expect(technologyFamily("python3")).toBe("python");
  expect(technologyFamily("Ruby 3.3.13")).toBe("ruby");
  for (const value of [
    "node-gyp",
    "node-red",
    "nodejs-nodemon",
    "gitpython",
    "python-pillow",
    "react-dom",
    "javafx",
    "openssl-fips",
  ])
    expect(technologyFamily(value)).toBe(value);
  expect(
    parseFeedQuery(
      new URLSearchParams({ technology: "nodejs,Node.js 22,node,ruby" }),
    ).technology,
  ).toBe("node-js,ruby");
});
it("matches family aliases in technology searches", () => {
  expect(matchingTechnologyFamilies("cpy")).toContain("python");
  expect(matchingTechnologyFamilies("Node.js")).toContain("node-js");
});
