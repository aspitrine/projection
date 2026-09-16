import { describe, expect, it } from "@effect/vitest";
import { Cause, Exit } from "effect";

import {
  REPLAY_WINDOW_MS,
  type QueuedCommand,
  enqueue,
  failedOnTransport,
  isTransportFailure,
  partitionExpired,
  withoutKey,
} from "../src/features/live/command-queue";

const command = (key: string, at: number): QueuedCommand => ({
  key,
  at,
  run: () => Promise.resolve(Exit.void),
});

describe("isTransportFailure", () => {
  it("reconnaît une panne de transport", () => {
    expect(isTransportFailure(Cause.fail({ _tag: "RpcClientError" }))).toBe(true);
    expect(isTransportFailure(Cause.fail({ _tag: "RequestError" }))).toBe(true);
    // `fetch` qui échoue : défaut sans balise.
    expect(isTransportFailure(Cause.die(new TypeError("Failed to fetch")))).toBe(true);
  });

  it("ne confond pas un refus métier avec une coupure", () => {
    expect(isTransportFailure(Cause.fail({ _tag: "NoLiveProject" }))).toBe(false);
    expect(isTransportFailure(Cause.fail({ _tag: "Forbidden" }))).toBe(false);
  });

  it("ignore une interruption", () => {
    expect(isTransportFailure(Cause.interrupt())).toBe(false);
  });

  it("ne met en file que les échecs, pas les succès", () => {
    expect(failedOnTransport(Exit.succeed(1))).toBe(false);
    expect(failedOnTransport(Exit.failCause(Cause.fail({ _tag: "RpcClientError" })))).toBe(true);
  });
});

describe("enqueue", () => {
  it("ne garde que la dernière commande d'une clé", () => {
    const queue = enqueue(enqueue([], command("cursor", 1)), command("cursor", 2));
    expect(queue).toHaveLength(1);
    expect(queue[0]?.at).toBe(2);
  });

  it("garde les clés distinctes, dans l'ordre d'émission", () => {
    const queue = enqueue(enqueue([], command("cursor", 1)), command("cover:room", 2));
    expect(queue.map((entry) => entry.key)).toEqual(["cursor", "cover:room"]);
  });

  it("remet la commande réémise en fin de file", () => {
    const queue = enqueue(
      enqueue(enqueue([], command("cursor", 1)), command("timer", 2)),
      command("cursor", 3),
    );
    expect(queue.map((entry) => entry.key)).toEqual(["timer", "cursor"]);
  });
});

describe("partitionExpired", () => {
  it("abandonne les commandes trop vieilles pour être rejouées", () => {
    const now = 100_000;
    const queue = [command("vieux", now - REPLAY_WINDOW_MS - 1), command("frais", now - 1_000)];
    const { live, expired } = partitionExpired(queue, now);
    expect(live.map((entry) => entry.key)).toEqual(["frais"]);
    expect(expired.map((entry) => entry.key)).toEqual(["vieux"]);
  });

  it("garde une commande pile à la limite", () => {
    const now = 100_000;
    const { live } = partitionExpired([command("limite", now - REPLAY_WINDOW_MS)], now);
    expect(live).toHaveLength(1);
  });
});

describe("withoutKey", () => {
  it("retire la commande une fois passée", () => {
    const queue = enqueue(enqueue([], command("cursor", 1)), command("timer", 2));
    expect(withoutKey(queue, "cursor").map((entry) => entry.key)).toEqual(["timer"]);
  });
});
