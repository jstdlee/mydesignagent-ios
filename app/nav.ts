// The navigation stack's state, created once; pages import it to navigate.
import { createNavStack } from "nsh/base";
import type { ArtifactType } from "./lib/types";

export type Route = { name: "library" } | { name: "artifact"; id: string; type: ArtifactType; title: string } | { name: "settings" };

export const nav = createNavStack<Route>([{ name: "library" }]);

export function openArtifact(item: { id: string; type: ArtifactType; title: string }) {
  nav.push({ name: "artifact", id: item.id, type: item.type, title: item.title });
}
