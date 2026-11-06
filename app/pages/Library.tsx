// The library: every artifact of every project on the paired computer, newest first, with
// search, type filters, sorting, pull to refresh and the ⌘K palette.
import { keymap, List, Scroll, signal, Text, View } from "nsh";
import { Button, Input, NavPage } from "nsh/base";
import { CommandPalette } from "../components/CommandPalette";
import { Header } from "../components/Header";
import { Badge, Chip, EmptyState, PrimaryButton, SecondaryButton, TypeTile } from "../components/ui";
import { plural, relativeTime, TYPE_FILTERS, TYPE_LABEL, TYPE_MARK } from "../lib/format";
import {
  connection,
  isLoadingLibrary,
  isOffline,
  library,
  libraryQuery,
  librarySort,
  libraryType,
  refreshLibrary,
  setLibraryQuery,
  setLibrarySort,
  setLibraryType,
  useDemo,
} from "../lib/store";
import type { ArtifactSummary, SortOrder } from "../lib/types";
import { nav, openArtifact } from "../nav";

const SORTS: { order: SortOrder; label: string }[] = [
  { order: "newest", label: "Newest" },
  { order: "oldest", label: "Oldest" },
  { order: "name", label: "Name" },
];

export function LibraryPage() {
  const paletteOpen = signal(false);
  keymap.bind("mod+k", () => paletteOpen.set(true), { when: "always" });
  const searchButton = () => (
    <Button onPress={() => paletteOpen.set(true)} accessibilityLabel="Search" testID="open-palette" class="active:opacity-60">
      <Text class="text-primary">Search</Text>
    </Button>
  );
  return (
    <NavPage
      title="Library"
      headerLargeTitle
      header={<Header title="Library" right={searchButton()} />}
      headerRight={searchButton()}
      ios={{ headerRightSymbol: "magnifyingglass" }}
    >
      <If when={connection()} else={<Welcome />}>
        <LibraryContent />
      </If>
      <CommandPalette open={paletteOpen()} onClose={() => paletteOpen.set(false)} />
    </NavPage>
  );
}

function Welcome() {
  return (
    <EmptyState
      title="Review what your agent designs"
      message="Pair with designagent-artifacts on your computer to see artboards, documents, live pages and verification rounds from every project."
    >
      <PrimaryButton label="Connect to your computer" onPress={() => nav.push({ name: "settings" })} testID="connect" />
      <SecondaryButton label="Try the demo workbench" onPress={useDemo} testID="try-demo" />
    </EmptyState>
  );
}

function LibraryContent() {
  const items = () => library()?.items ?? [];
  const nextSort = () => {
    const i = SORTS.findIndex((s) => s.order === librarySort());
    setLibrarySort(SORTS[(i + 1) % SORTS.length].order);
  };
  return (
    <View class="flex-1 pb-[env(safe-area-inset-bottom)]">
      <View class="gap-3 px-4 pt-3">
        <Input
          value={libraryQuery()}
          onChange={({ value }) => setLibraryQuery(value)}
          placeholder="Search titles, projects and ids"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          testID="library-search"
          class="rounded-(--radius) bg-muted px-3 py-2.5 text-foreground"
        />
        <Scroll horizontal class="-mx-4" scrollbar={false}>
          <View class="flex-row gap-2 px-4">
            <Each of={TYPE_FILTERS} key={(f: (typeof TYPE_FILTERS)[number]) => f.label}>
              {(filter) => (
                <Chip label={filter().label} selected={libraryType() === filter().type} onPress={() => setLibraryType(filter().type)} testID={`filter-${filter().label}`} />
              )}
            </Each>
          </View>
        </Scroll>
        <View class="flex-row items-center justify-between">
          <Text class="text-sm text-muted-foreground">
            {plural(items().length, "artifact")}
            {library() ? ` · ${plural(library()?.projects.length ?? 0, "project")}` : ""}
          </Text>
          <View class="flex-row items-center gap-4">
            <Button onPress={nextSort} accessibilityLabel={`Sort: ${SORTS.find((s) => s.order === librarySort())?.label}`} testID="sort" class="active:opacity-60">
              <Text class="text-sm text-primary">Sort: {SORTS.find((s) => s.order === librarySort())?.label}</Text>
            </Button>
            <Button onPress={() => nav.push({ name: "settings" })} testID="settings" class="active:opacity-60">
              <Text class="text-sm text-primary">{connection()?.mode === "demo" ? "Demo" : "Connection"}</Text>
            </Button>
          </View>
        </View>
        <If when={isOffline()}>
          <View class="rounded-(--radius) bg-destructive/10 p-3">
            <Text class="text-sm text-destructive">Can't reach your computer. Showing what was loaded last.</Text>
          </View>
        </If>
      </View>
      <If
        when={items().length > 0}
        else={
          <If when={library()} else={<EmptyState title="Loading" message="Reading the library…" />}>
            <EmptyState
              title={libraryQuery() || libraryType() ? "Nothing matches" : "No artifacts yet"}
              message={
                libraryQuery() || libraryType()
                  ? "Try another search or filter."
                  : "Ask your agent to brainstorm a feature: its artboards and documents appear here as it writes them."
              }
            />
          </If>
        }
      >
        <List
          each={items()}
          keyExtractor={(a: ArtifactSummary) => a.id}
          estimatedItemSize={84}
          onRefresh={() => refreshLibrary(true)}
          refreshing={isLoadingLibrary()}
          class="mt-2 flex-1"
          testID="library-list"
        >
          {(item) => (
            <Button onPress={() => openArtifact(item())} class="flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-muted">
              <TypeTile mark={TYPE_MARK[item().type]} />
              <View class="flex-1 gap-0.5">
                <Text class="font-medium text-foreground" style={{ numberOfLines: 1 }}>
                  {item().title}
                </Text>
                <Text class="text-xs text-muted-foreground" style={{ numberOfLines: 1 }}>
                  {TYPE_LABEL[item().type]} · {item().project.name} · {relativeTime(item().updatedAt)}
                </Text>
                <Text class="text-sm text-muted-foreground" style={{ numberOfLines: 1 }}>
                  {item().preview}
                </Text>
              </View>
              <If when={item().stats.rejected > 0}>
                <Badge label={`${item().stats.rejected} rejected`} tone="danger" />
              </If>
              <If when={item().stats.comments > 0 && item().stats.rejected === 0}>
                <Badge label={String(item().stats.comments)} tone="accent" />
              </If>
            </Button>
          )}
        </List>
      </If>
    </View>
  );
}
