// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Cause, Exit } from "effect";
import { afterEach, beforeEach, vi } from "vitest";

import {
  PendingBanner,
  PendingCommands,
  useRun,
  usePendingCommands,
} from "../src/features/live/commands";

// Faux timers dès le rendu : la boucle de rejeu s'installe au premier échec.
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const transportFailure = Exit.failCause(Cause.fail({ _tag: "RpcClientError" }));
const refusal = Exit.failCause(Cause.fail({ _tag: "NoLiveProject" }));

/** Page minimale : un bouton par commande, comme la régie. */
function Harness({
  action,
  replayKey,
}: {
  action: () => Promise<Exit.Exit<unknown, unknown>>;
  replayKey?: string;
}) {
  const commands = usePendingCommands();
  return (
    <PendingCommands.Provider value={commands}>
      <PendingBanner pending={commands.pending} />
      <Command action={action} replayKey={replayKey} />
    </PendingCommands.Provider>
  );
}

function Command({
  action,
  replayKey,
}: {
  action: () => Promise<Exit.Exit<unknown, unknown>>;
  replayKey?: string;
}) {
  const run = useRun();
  return (
    <button type="button" onClick={() => void run(action, replayKey)}>
      commande
    </button>
  );
}

const click = async () => {
  await act(async () => {
    screen.getByRole("button", { name: "commande" }).click();
  });
};

const pending = () => screen.queryByTestId("live-pending");

describe("file des commandes de la régie", () => {
  it("rejoue une commande d'état dès que le serveur répond", async () => {
    let coupure = true;
    const action = vi.fn(() => Promise.resolve(coupure ? transportFailure : Exit.succeed(null)));

    render(<Harness action={action} replayKey="cursor" />);
    await click();
    expect(pending()?.textContent).toContain("1");

    coupure = false;
    // La boucle de rejeu tourne toutes les deux secondes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(action).toHaveBeenCalledTimes(2);
    expect(pending()).toBeNull();
  });

  it("ne met pas en file une commande sans clé de rejeu", async () => {
    const action = vi.fn(() => Promise.resolve(transportFailure));
    render(<Harness action={action} />);
    await click();
    expect(pending()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("ne rejoue pas un refus du serveur", async () => {
    const action = vi.fn(() => Promise.resolve(refusal));
    render(<Harness action={action} replayKey="cursor" />);
    await click();
    expect(pending()).toBeNull();
  });

  it("ne garde qu'une commande par clé", async () => {
    const action = vi.fn(() => Promise.resolve(transportFailure));
    render(<Harness action={action} replayKey="cursor" />);
    await click();
    await click();
    expect(pending()?.textContent).toContain("1");
  });

  it("abandonne une commande que la coupure a laissée trop longtemps en attente", async () => {
    const action = vi.fn(() => Promise.resolve(transportFailure));
    render(<Harness action={action} replayKey="cursor" />);
    await click();
    expect(pending()).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });

    expect(pending()).toBeNull();
  });
});
