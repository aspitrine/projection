import { describe, expect, it } from "@effect/vitest";

import { detectXmlFormat, parseOsis, parseZefania } from "../src/domain/Osis";

const osisContainer = `<?xml version="1.0" encoding="UTF-8"?>
<osis xmlns="http://www.bibletechnologies.net/2003/OSIS/namespace">
  <osisText osisIDWork="Test" xml:lang="fr">
    <div type="book" osisID="John">
      <chapter osisID="John.3">
        <verse osisID="John.3.16">Car Dieu a tant aim&#233; le monde<note type="crossReference">Ro 5:8</note></verse>
        <verse osisID="John.3.17">Dieu n&apos;a pas envoy&#233; son Fils   pour juger</verse>
      </chapter>
    </div>
    <div type="book" osisID="Tob">
      <verse osisID="Tob.1.1">Livre deut&#233;rocanonique</verse>
    </div>
  </osisText>
</osis>`;

const osisMilestones = `<osis><osisText>
  <div type="book" osisID="Ps">
    <verse osisID="Ps.23.1" sID="Ps.23.1"/>L'&#201;ternel est mon berger<verse eID="Ps.23.1"/>
    <verse osisID="Ps.23.2" sID="Ps.23.2"/>Il me fait reposer<verse eID="Ps.23.2"/>
  </div>
</osisText></osis>`;

const zefania = `<?xml version="1.0" encoding="UTF-8"?>
<XMLBIBLE biblename="Test">
  <BIBLEBOOK bnumber="43" bname="John">
    <CHAPTER cnumber="3">
      <VERS vnumber="16">Car Dieu a tant aim&#233; le monde<NOTE>note</NOTE></VERS>
      <VERS vnumber="17">Dieu n'a pas envoy&#233; son Fils</VERS>
    </CHAPTER>
  </BIBLEBOOK>
  <BIBLEBOOK bnumber="70" bname="Tobit">
    <CHAPTER cnumber="1"><VERS vnumber="1">Hors canon</VERS></CHAPTER>
  </BIBLEBOOK>
</XMLBIBLE>`;

describe("detectXmlFormat", () => {
  it("reconnaît OSIS, Zefania, et rien d'autre", () => {
    expect(detectXmlFormat(osisContainer)).toBe("osis");
    expect(detectXmlFormat(zefania)).toBe("zefania");
    expect(detectXmlFormat("<html><body>bonjour</body></html>")).toBeNull();
  });
});

describe("parseOsis", () => {
  it("lit les versets, décode les entités, retire notes et livres hors canon", () => {
    const books = parseOsis(osisContainer);
    expect(books.map((book) => book.code)).toEqual(["JHN"]);
    expect(books[0]?.verses).toEqual([
      { chapter: 3, verse: 16, text: "Car Dieu a tant aimé le monde" },
      { chapter: 3, verse: 17, text: "Dieu n'a pas envoyé son Fils pour juger" },
    ]);
  });

  it("accepte l'écriture par jalons sID", () => {
    const books = parseOsis(osisMilestones);
    expect(books[0]?.code).toBe("PSA");
    expect(books[0]?.verses).toEqual([
      { chapter: 23, verse: 1, text: "L'Éternel est mon berger" },
      { chapter: 23, verse: 2, text: "Il me fait reposer" },
    ]);
  });
});

describe("parseZefania", () => {
  it("lit les livres par numéro et ignore ceux hors canon", () => {
    const books = parseZefania(zefania);
    expect(books.map((book) => book.code)).toEqual(["JHN"]);
    expect(books[0]?.verses.map((verse) => verse.text)).toEqual([
      "Car Dieu a tant aimé le monde",
      "Dieu n'a pas envoyé son Fils",
    ]);
  });
});
