import { readFileSync, writeFileSync } from "node:fs";

// A BOM (some editors add one) is dropped; anything else wrong names the file.
export function readJson(path) {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
