// The ⌘K palette: jump to any artifact across projects by title, project or id, or run a
// command. Opened from the library's search button, or ⌘K on a hardware keyboard.
import { platform, signal, Text, View } from "nsh";
import { Button, Input, Sheet } from "nsh/base";
import { TYPE_LABEL, TYPE_MARK, TYPE_PLURAL } from "../lib/format";
import { library, refreshLibrary, setLibraryType } from "../lib/store";
import type { ArtifactSummary, ArtifactType } from "../lib/types";
import { openArtifact, openSettings } from "../nav";
import { TypeTile } from "./ui";

interface Command {
  id: string;
  label: string;
  run: () => void;
}

const COMMANDS: Command[] = [
  { id: "refresh", label: "Refresh the library", run: () => refreshLibrary(true) },
  { id: "settings", label: "Connection settings", run: openSettings },
  ...(["artboard", "document", "html", "verify"] as ArtifactType[]).map((type) => ({
    id: `filter-${type}`,
    label: `Show only ${TYPE_PLURAL[type]}`,
    run: () => setLibraryType(type),
  })),
  { id: "filter-all", label: "Show everything", run: () => setLibraryType(null) },
];

/** Artifacts whose title, project, slug or id contain every word of the query. */
export function matchArtifacts(items: ArtifactSummary[], query: string): ArtifactSummary[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items.slice(0, 8);
  return items.filter((a) => {
    const hay = `${a.title} ${a.project.name} ${a.slug} ${a.id} ${a.type}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

const openSignal = signal(false);
/** Whether the palette is showing; one palette serves the whole app. */
export const isPaletteOpen = () => openSignal();
export const openPalette = () => openSignal.set(true);

export function CommandPalette() {
  const query = signal("");
  const results = () => matchArtifacts(library()?.items ?? [], query()).slice(0, 12);
  const commands = () => COMMANDS.filter((c) => c.label.toLowerCase().includes(query().trim().toLowerCase()));
  const close = () => {
    query.set("");
    openSignal.set(false);
  };
  const choose = (run: () => void) => {
    close();
    run();
  };
  return (
    <Sheet
      open={openSignal()}
      onOpenChange={(e) => {
        if (!e.open) close();
      }}
      side="top"
      popupClass={`gap-3 bg-background px-4 pb-4 ${platform.desktop ? "mx-auto mt-16 w-full max-w-xl rounded-2xl pt-1 shadow-2xl" : "rounded-b-3xl pt-[env(safe-area-inset-top)]"}`}
      backdropClass="bg-black/40"
    >
      <Input
        value={query()}
        onChange={({ value }) => query.set(value)}
        onSubmit={() => {
          const first = results()[0];
          if (first) choose(() => openArtifact(first));
        }}
        placeholder="Jump to an artifact or command"
        returnKeyType="go"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        testID="palette-input"
        class="mt-3 rounded-(--radius) bg-muted px-3 py-2.5 text-foreground"
      />
      <View class="gap-1">
        <Each of={results()} key={(a: ArtifactSummary) => a.id}>
          {(item) => (
            <Button onPress={() => choose(() => openArtifact(item()))} class="flex-row items-center gap-3 rounded-(--radius) p-2 hover:bg-muted active:bg-muted">
              <TypeTile mark={TYPE_MARK[item().type]} />
              <View class="flex-1">
                <Text class="text-foreground" style={{ numberOfLines: 1 }}>
                  {item().title}
                </Text>
                <Text class="text-xs text-muted-foreground">
                  {TYPE_LABEL[item().type]} · {item().project.name}
                </Text>
              </View>
            </Button>
          )}
        </Each>
        <Each of={commands()} key={(c: Command) => c.id}>
          {(command) => (
            <Button onPress={() => choose(command().run)} class="rounded-(--radius) px-2 py-2.5 hover:bg-muted active:bg-muted">
              <Text class="text-primary">{command().label}</Text>
            </Button>
          )}
        </Each>
      </View>
    </Sheet>
  );
}
