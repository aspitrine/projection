import { Exit } from "effect";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { m } from "@/paraglide/messages";

import {
  type QueuedCommand,
  enqueue,
  failedOnTransport,
  partitionExpired,
  withoutKey,
} from "./command-queue";

/** Intervalle entre deux tentatives de rejeu, tant que la file n'est pas vide. */
export const REPLAY_INTERVAL_MS = 2000;

/** Commandes en attente de rejeu, partagées par toute la page. */
export const PendingCommands = createContext<{
  readonly pending: number;
  run: (action: () => Promise<Exit.Exit<unknown, unknown>>, replayKey?: string) => Promise<void>;
}>({ pending: 0, run: async () => undefined });

/**
 * Lance les commandes de la régie et rattrape les coupures réseau : une commande qui
 * décrit un état visé (`replayKey`) est mise de côté puis rejouée dès que le serveur
 * répond, la dernière de chaque clé seulement. Les commandes relatives (« suivante »)
 * ne sont jamais rejouées : quelques secondes plus tard, elles ne veulent plus rien dire.
 */
export function usePendingCommands() {
  const [queue, setQueue] = useState<ReadonlyArray<QueuedCommand>>([]);
  const replaying = useRef(false);

  const run = useCallback(
    async (action: () => Promise<Exit.Exit<unknown, unknown>>, replayKey?: string) => {
      const exit = await action();
      if (!Exit.isFailure(exit)) {
        if (replayKey !== undefined) setQueue((current) => withoutKey(current, replayKey));
        return;
      }
      if (replayKey === undefined || !failedOnTransport(exit)) {
        toast.error(m.live_action_error());
        return;
      }
      setQueue((current) => enqueue(current, { key: replayKey, at: Date.now(), run: action }));
    },
    [],
  );

  // Tant qu'il reste des commandes, on retente régulièrement et on oublie les périmées.
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setInterval(() => {
      if (replaying.current) return;
      const { live, expired } = partitionExpired(queue, Date.now());
      if (expired.length > 0) {
        setQueue(live);
        toast.error(m.live_queue_dropped({ count: expired.length }));
        return;
      }
      replaying.current = true;
      void (async () => {
        for (const command of live) {
          const exit = await command.run();
          if (Exit.isFailure(exit) && failedOnTransport(exit)) break;
          setQueue((current) => withoutKey(current, command.key));
        }
        replaying.current = false;
      })();
    }, REPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [queue]);

  return { pending: queue.length, run };
}

export function useRun() {
  return useContext(PendingCommands).run;
}

/** Coupure en cours : l'opérateur voit que ses derniers gestes attendent le serveur. */
export function PendingBanner({ pending }: { pending: number }) {
  if (pending === 0) return null;
  return (
    <p
      role="status"
      data-testid="live-pending"
      className="sticky top-0 z-40 bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-200"
    >
      {m.live_queue_pending({ count: pending })}
    </p>
  );
}
