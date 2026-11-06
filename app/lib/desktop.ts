// What the desktop app adds around the shared screens: the window's size and title, a title
// bar of the app's own, and the application menu with its shortcuts. Called once at start,
// and only where nsh/desktop's window and menu APIs exist (macOS, Windows, Linux).
import { effect, openUrl, platform } from "nsh";
import { Menu, type MenuItem, Window } from "nsh/desktop";
import { openPalette } from "../components/CommandPalette";
import { SORTS } from "../components/LibraryBrowser";
import { currentArtifactId, openArtifact, openSettings } from "../nav";
import { TYPE_FILTERS } from "./format";
import { artifactById, connection, disconnect, library, librarySort, libraryType, refreshLibrary, setLibrarySort, setLibraryType, useDemo, webUrl } from "./store";

export const TITLE_BAR_HEIGHT = 44;

/** Moves the selection up or down the library, as the list shows it. */
export function stepSelection(delta: 1 | -1) {
  const items = library()?.items ?? [];
  if (!items.length) return;
  const current = currentArtifactId();
  const i = items.findIndex((a) => a.id === current);
  const next = i < 0 ? (delta > 0 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, i + delta));
  if (items[next].id !== current) openArtifact(items[next]);
}

/** The page of the current artifact a browser can open, when the server has one. */
function currentBrowserLink(): string | null {
  const id = currentArtifactId();
  const artifact = id ? artifactById(id) : undefined;
  if (!artifact) return null;
  return artifact.type === "html" ? webUrl(`/a/${artifact.id}/page`) : webUrl(`/api/v1/artifacts/${artifact.id}`);
}

/** The application menu; it reads signals, so an effect keeps checks and states current. */
export function appMenu(): MenuItem[] {
  const mac = platform.os === "macos";
  const connected = Boolean(connection());
  const link = currentBrowserLink();
  const appItems: MenuItem[] = [
    { role: "about" },
    { type: "separator" },
    { label: "Connection…", shortcut: "mod+,", onSelect: openSettings },
    { type: "separator" },
    { role: "hide" },
    { role: "hideOthers" },
    { role: "showAll" },
    { type: "separator" },
    { role: "quit" },
  ];
  return [
    mac && { label: "Design Agent", submenu: appItems },
    {
      label: "File",
      submenu: [
        { label: "Find Artifact…", shortcut: "mod+k", disabled: !connected, onSelect: openPalette },
        { label: "Refresh Library", shortcut: "mod+r", disabled: !connected, onSelect: () => refreshLibrary(true) },
        { label: "Open in Browser", shortcut: "mod+shift+o", disabled: !link, onSelect: () => link && openUrl(link) },
        { type: "separator" },
        !mac && { label: "Connection…", shortcut: "mod+,", onSelect: openSettings },
        { label: "Use Demo Workbench", onSelect: useDemo },
        { label: "Disconnect", disabled: !connected, onSelect: disconnect },
        { type: "separator" },
        { role: "close" },
        !mac && { role: "quit" },
      ].filter(Boolean) as MenuItem[],
    },
    {
      label: "Edit",
      submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
    },
    {
      label: "View",
      submenu: [
        ...TYPE_FILTERS.map((f, i) => ({
          label: f.type ? `Only ${f.label}` : "All Artifacts",
          shortcut: `mod+${i + 1}`,
          checked: libraryType() === f.type,
          onSelect: () => setLibraryType(f.type),
        })),
        { type: "separator" },
        {
          label: "Sort By",
          submenu: SORTS.map((s) => ({ label: s.label, checked: librarySort() === s.order, onSelect: () => setLibrarySort(s.order) })),
        },
        { type: "separator" },
        { role: "toggleFullScreen" },
      ],
    },
    {
      label: "Go",
      submenu: [
        { label: "Next Artifact", shortcut: "mod+alt+down", disabled: !connected, onSelect: () => stepSelection(1) },
        { label: "Previous Artifact", shortcut: "mod+alt+up", disabled: !connected, onSelect: () => stepSelection(-1) },
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }] },
  ].filter(Boolean) as MenuItem[];
}

let installed = false;

export function installDesktop() {
  if (installed) return;
  installed = true;
  Window.setTitleBar({ style: "hidden", height: TITLE_BAR_HEIGHT });
  // Linux opens a phone-sized window by default; a review workbench wants room for two panes.
  Window.setFrame({ size: { width: 1280, height: 820 } });
  effect(() => Menu.setApplicationMenu(appMenu()));
  effect(() => {
    const id = currentArtifactId();
    const title = id ? artifactById(id)?.title : undefined;
    Window.setTitle(title ? `${title} — Design Agent` : "Design Agent");
  });
}
