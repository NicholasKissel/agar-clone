import { setup } from "rivetkit";
import { match } from "./match.js";
import { matchmaker } from "./matchmaker.js";

export const registry = setup({
  use: { match, matchmaker },
});

export type Registry = typeof registry;
