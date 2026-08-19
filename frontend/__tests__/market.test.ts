import { beforeEach, describe, expect, it } from "vitest";
import { getMarket, setMarket } from "../lib/market";

describe("market", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to HK when nothing is stored", () => {
    expect(getMarket()).toBe("HK");
  });

  it("persists a chosen market across reads", () => {
    setMarket("NL");
    expect(getMarket()).toBe("NL");
  });
});
