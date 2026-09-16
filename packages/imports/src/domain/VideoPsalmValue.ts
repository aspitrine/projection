/**
 * Lecture des fichiers `.json` de VideoPsalm, qui ne sont ni du JSON ni du JSON5 :
 * clés non quotées, retours à la ligne bruts dans les chaînes, nombres non quotés.
 * Le lecteur est volontairement tolérant : ce qu'il ne comprend pas devient `null`.
 */
export type VideoPsalmValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<VideoPsalmValue>
  | { readonly [key: string]: VideoPsalmValue };

const isSpace = (char: string) => char === " " || char === "\t" || char === "\n" || char === "\r";

class Reader {
  private index = 0;

  constructor(private readonly source: string) {}

  skipSpaces() {
    while (this.index < this.source.length && isSpace(this.source[this.index]!)) this.index += 1;
  }

  peek() {
    return this.source[this.index];
  }

  take() {
    const char = this.source[this.index];
    this.index += 1;
    return char;
  }

  /** Chaîne entre guillemets doubles : les retours à la ligne bruts sont conservés. */
  readString(): string {
    this.take();
    let value = "";
    while (this.index < this.source.length) {
      const char = this.take();
      if (char === '"') return value;
      if (char === "\\") {
        const escaped = this.take();
        value +=
          escaped === "n"
            ? "\n"
            : escaped === "t"
              ? "\t"
              : escaped === "r"
                ? "\r"
                : (escaped ?? "");
        continue;
      }
      value += char ?? "";
    }
    return value;
  }

  readBareToken(): string {
    let value = "";
    while (this.index < this.source.length) {
      const char = this.peek()!;
      if (isSpace(char) || char === ":" || char === "," || char === "}" || char === "]") break;
      value += this.take();
    }
    return value;
  }

  readValue(): VideoPsalmValue {
    this.skipSpaces();
    const char = this.peek();
    if (char === undefined) return null;
    if (char === '"') return this.readString();
    if (char === "{") return this.readObject();
    if (char === "[") return this.readArray();

    const token = this.readBareToken();
    if (token === "true") return true;
    if (token === "false") return false;
    if (token === "null" || token === "") return null;
    const numeric = Number(token);
    return Number.isNaN(numeric) ? token : numeric;
  }

  readObject(): VideoPsalmValue {
    this.take();
    const result: Record<string, VideoPsalmValue> = {};
    for (;;) {
      this.skipSpaces();
      const char = this.peek();
      if (char === undefined) return result;
      if (char === "}") {
        this.take();
        return result;
      }
      if (char === "," || char === ":") {
        this.take();
        continue;
      }
      const key = char === '"' ? this.readString() : this.readBareToken();
      this.skipSpaces();
      if (this.peek() === ":") this.take();
      result[key] = this.readValue();
    }
  }

  readArray(): VideoPsalmValue {
    this.take();
    const result: Array<VideoPsalmValue> = [];
    for (;;) {
      this.skipSpaces();
      const char = this.peek();
      if (char === undefined) return result;
      if (char === "]") {
        this.take();
        return result;
      }
      if (char === ",") {
        this.take();
        continue;
      }
      result.push(this.readValue());
    }
  }
}

export const parseVideoPsalmValue = (source: string): VideoPsalmValue =>
  new Reader(source.replace(/^﻿/, "")).readValue();

export const asRecord = (value: VideoPsalmValue | undefined) =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as { readonly [key: string]: VideoPsalmValue })
    : null;

export const asArray = (value: VideoPsalmValue | undefined): ReadonlyArray<VideoPsalmValue> =>
  Array.isArray(value) ? value : [];

export const asText = (value: VideoPsalmValue | undefined) =>
  typeof value === "string" ? value : null;

export const asNumber = (value: VideoPsalmValue | undefined) =>
  typeof value === "number" ? value : null;
