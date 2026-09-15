import { describe, expect, it } from "@effect/vitest";

import { goTo, initialLiveState, toggleBlackout } from "../src/domain/LiveState";

describe("LiveState", () => {
  it("goTo incrémente la version et borne l'index à 0", () => {
    const state = goTo(initialLiveState, -3, 1000);
    expect(state.slideIndex).toBe(0);
    expect(state.version).toBe(1);
    expect(state.updatedAt).toBe(1000);
  });

  it("toggleBlackout inverse l'écran noir", () => {
    const state = toggleBlackout(toggleBlackout(initialLiveState, 1), 2);
    expect(state.blackout).toBe(false);
    expect(state.version).toBe(2);
  });
});
