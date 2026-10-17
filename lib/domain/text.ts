/** Collapse every run of whitespace (including newlines) to one space. Used on free text that is placed inside a fixed template, so a typed line break can never add a fake clause or line to a document. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
