/** Collapse every run of whitespace (including newlines) to one space. Used on free text that is placed inside a fixed template, so a typed line break can never add a fake clause or line to a document. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** "1 month", "2 months". Use this everywhere a count is followed by a noun. */
export function plural(count: number, singular: string, pluralForm: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
