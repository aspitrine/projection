import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@projection/ui/components/button";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { goToAtom, liveStateAtom, toggleBlackoutAtom } from "@/features/live/atoms";

export const Route = createFileRoute("/spike/live")({
  component: () => (
    <ClientOnly fallback={null}>
      <LiveSpike />
    </ClientOnly>
  ),
});

function LiveSpike() {
  const result = useAtomValue(liveStateAtom);
  const goTo = useAtomSet(goToAtom);
  const toggleBlackout = useAtomSet(toggleBlackoutAtom);

  if (result._tag !== "Success") {
    return (
      <p className="p-6" data-testid="live-status">
        {result._tag === "Failure" ? "Déconnecté" : "Connexion…"}
      </p>
    );
  }

  const { state, receivedAt, initial } = result.value;

  return (
    <div className="container mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Spike temps réel</h1>
      <dl className="grid grid-cols-2 gap-2 rounded-lg border p-4 text-sm" data-testid="live-state">
        <dt>Diapo</dt>
        <dd data-testid="live-slide">{state.slideIndex}</dd>
        <dt>Écran noir</dt>
        <dd data-testid="live-blackout">{state.blackout ? "oui" : "non"}</dd>
        <dt>Version</dt>
        <dd data-testid="live-version">{state.version}</dd>
        <dt>Latence serveur → client</dt>
        <dd data-testid="live-latency">
          {initial ? "— (état initial)" : `${receivedAt - state.updatedAt} ms`}
        </dd>
      </dl>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => goTo({ payload: { slideIndex: state.slideIndex - 1 } })}
        >
          Précédente
        </Button>
        <Button onClick={() => goTo({ payload: { slideIndex: state.slideIndex + 1 } })}>
          Suivante
        </Button>
        <Button variant="destructive" onClick={() => toggleBlackout({ payload: undefined })}>
          Noir
        </Button>
      </div>
    </div>
  );
}
