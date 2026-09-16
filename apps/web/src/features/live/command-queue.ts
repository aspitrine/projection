import { Cause, Exit, Option } from "effect";

/**
 * File des commandes de régie émises pendant une coupure réseau.
 *
 * Toutes les commandes ne se rejouent pas : « diapo suivante » dépend de la position
 * courante et n'a plus de sens quelques secondes plus tard, alors que « aller à cette
 * diapo » ou « écran noir » décrivent un état visé, qu'on peut réappliquer sans surprise.
 * Seules ces dernières portent une `replayKey` ; la file n'en garde qu'une par clé — la
 * dernière intention de l'opérateur — et les oublie passé la fenêtre de rejeu.
 */
export interface QueuedCommand {
  readonly key: string;
  readonly at: number;
  readonly run: () => Promise<Exit.Exit<unknown, unknown>>;
}

/** Au-delà, la commande décrit une intention dépassée : la rejouer surprendrait l'opérateur. */
export const REPLAY_WINDOW_MS = 20_000;

const tagOf = (error: unknown) =>
  typeof error === "object" && error !== null && "_tag" in error ? error._tag : undefined;

const transportTags = new Set(["RpcClientError", "RpcClientDefect", "RequestError"]);

/**
 * Vrai quand l'échec vient du transport (serveur injoignable, flux coupé) et non d'un refus
 * métier : une commande refusée par le serveur ne doit surtout pas être rejouée.
 */
export const isTransportFailure = <E>(cause: Cause.Cause<E>): boolean => {
  if (Cause.hasInterruptsOnly(cause)) return false;
  // Un `fetch` qui n'aboutit pas remonte en défaut, sans balise : c'est déjà le réseau.
  if (Cause.hasDies(cause)) return true;
  return Option.match(Cause.findErrorOption(cause), {
    onNone: () => false,
    onSome: (error) => transportTags.has(String(tagOf(error))),
  });
};

export const failedOnTransport = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isFailure(exit) && isTransportFailure(exit.cause);

/** File immuable : la dernière commande d'une clé remplace la précédente. */
export const enqueue = (
  queue: ReadonlyArray<QueuedCommand>,
  command: QueuedCommand,
): ReadonlyArray<QueuedCommand> => [
  ...queue.filter((pending) => pending.key !== command.key),
  command,
];

/** Sépare ce qui reste rejouable de ce que l'attente a périmé. */
export const partitionExpired = (
  queue: ReadonlyArray<QueuedCommand>,
  now: number,
  window: number = REPLAY_WINDOW_MS,
): {
  readonly live: ReadonlyArray<QueuedCommand>;
  readonly expired: ReadonlyArray<QueuedCommand>;
} => ({
  live: queue.filter((command) => now - command.at <= window),
  expired: queue.filter((command) => now - command.at > window),
});

export const withoutKey = (queue: ReadonlyArray<QueuedCommand>, key: string) =>
  queue.filter((command) => command.key !== key);
