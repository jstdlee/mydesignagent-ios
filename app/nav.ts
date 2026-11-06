// Where the person is. On phones and narrow windows, a navigation stack; on desktops with a
// wide window, the library stays in a sidebar and the selection fills the pane beside it.
// Pages call these functions and never ask which layout is showing.
import { effect, platform, signal, untracked, windowSize } from "nsh";
import { createNavStack } from "nsh/base";
import type { ArtifactType } from "./lib/types";

export type Route = { name: "library" } | { name: "artifact"; id: string; type: ArtifactType; title: string } | { name: "settings" };

export const nav = createNavStack<Route>([{ name: "library" }]);

/** The desktop's side-by-side layout: a desktop and a window wide enough for two panes. */
export const SPLIT_MIN_WIDTH = 900;
export const isSplitLayout = () => platform.desktop && windowSize().width >= SPLIT_MIN_WIDTH;

const paneSignal = signal<Route>({ name: "library" });
/** What the desktop's detail pane shows ("library" is its empty state). */
export const pane = () => paneSignal();

export function openArtifact(item: { id: string; type: ArtifactType; title: string }) {
  const route: Route = { name: "artifact", id: item.id, type: item.type, title: item.title };
  if (isSplitLayout()) paneSignal.set(route);
  else nav.push(route);
}

export function openSettings() {
  if (isSplitLayout()) paneSignal.set({ name: "settings" });
  else if (nav.routes().at(-1)?.name !== "settings") nav.push({ name: "settings" });
}

/** Leaves the connection settings, after connecting or choosing the demo. */
export function closeSettings() {
  if (isSplitLayout()) paneSignal.set({ name: "library" });
  else if (nav.routes().at(-1)?.name === "settings") nav.pop();
}

/** The artifact on screen: the pane's on a desktop, the stack's top elsewhere. */
export function currentArtifactId(): string | null {
  const route = isSplitLayout() ? paneSignal() : nav.routes().at(-1);
  return route?.name === "artifact" ? route.id : null;
}

// Resizing a desktop window across SPLIT_MIN_WIDTH keeps the person where they were: the
// stack's top page moves into the pane, and the pane's selection onto the stack.
let wasSplit: boolean | null = null;
effect(() => {
  const split = isSplitLayout();
  untracked(() => {
    if (wasSplit === null || wasSplit === split) {
      wasSplit = split;
      return;
    }
    wasSplit = split;
    if (split) {
      const top = nav.routes().at(-1);
      paneSignal.set(top && top.name !== "library" ? top : { name: "library" });
      nav.setRoutes([{ name: "library" }]);
    } else {
      const shown = paneSignal();
      nav.setRoutes(shown.name === "library" ? [{ name: "library" }] : [{ name: "library" }, shown]);
    }
  });
});
