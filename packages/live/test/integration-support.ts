import { deckOf, item } from "./support";

export { itemId, makeDeckSource, makeSongEditing, organizationId, projectId } from "./support";

export const baseDeckForIntegration = deckOf([item(1, ["A1", "A2"]), item(2, []), item(3, ["C1"])]);
