// The library's search, filters, sort and list: the phone's whole Library page, and the
// desktop's sidebar. On desktops a row also answers right clicks with a context menu.
import { Clipboard, List, openUrl, Scroll, Text, View } from "nsh";
import { Button, Input } from "nsh/base";
import { isAvailable as hasDesktopMenus, Menu } from "nsh/desktop";
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
  showToast,
  webUrl,
} from "../lib/store";
import type { ArtifactSummary, SortOrder } from "../lib/types";
import { openArtifact, openSettings } from "../nav";
import { Badge, Chip, EmptyState, TypeTile } from "./ui";

export const SORTS: { order: SortOrder; label: string }[] = [
  { order: "newest", label: "Newest" },
  { order: "oldest", label: "Oldest" },
  { order: "name", label: "Name" },
];

export const sortLabel = () => SORTS.find((s) => s.order === librarySort())?.label ?? "Newest";

export function nextSort() {
  const i = SORTS.findIndex((s) => s.order === librarySort());
  setLibrarySort(SORTS[(i + 1) % SORTS.length].order);
}

/** The page link of an artifact a browser can open, when the server has one. */
function browserLink(item: ArtifactSummary): string | null {
  return item.type === "html" ? webUrl(`/a/${item.id}/page`) : webUrl(`/api/v1/artifacts/${item.id}`);
}

/** The menu a right click on a row shows. */
export function rowMenu(item: ArtifactSummary) {
  const link = browserLink(item);
  return [
    { label: "Open", onSelect: () => openArtifact(item) },
    { type: "separator" as const },
    {
      label: "Copy ID",
      onSelect: () => {
        Clipboard.writeText(item.id);
        showToast("Copied the artifact's id");
      },
    },
    {
      label: "Copy CLI reference",
      onSelect: () => {
        Clipboard.writeText(`${item.type}/${item.slug}`);
        showToast(`Copied ${item.type}/${item.slug}`);
      },
    },
    link && { label: "Open in browser", onSelect: () => openUrl(link) },
    { type: "separator" as const },
    { label: `Show only ${TYPE_LABEL[item.type].toLowerCase()}s`, onSelect: () => setLibraryType(item.type) },
  ];
}

export function LibraryBrowser(props: { selectedId?: string | null; dense?: boolean }) {
  const items = () => library()?.items ?? [];
  return (
    <View class="flex-1 pb-[env(safe-area-inset-bottom)]">
      <View class={`gap-3 ${props.dense ? "px-3 pt-2" : "px-4 pt-3"}`}>
        <Input
          value={libraryQuery()}
          onChange={({ value }) => setLibraryQuery(value)}
          placeholder="Search titles, projects and ids"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          testID="library-search"
          class={`rounded-(--radius) bg-muted px-3 text-foreground ${props.dense ? "py-1.5 text-sm" : "py-2.5"}`}
        />
        <Scroll horizontal class={props.dense ? "-mx-3" : "-mx-4"} scrollbar={false}>
          <View class={`flex-row gap-2 ${props.dense ? "px-3" : "px-4"}`}>
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
            <Button onPress={nextSort} accessibilityLabel={`Sort: ${sortLabel()}`} testID="sort" class="active:opacity-60 hover:opacity-80">
              <Text class="text-sm text-primary">Sort: {sortLabel()}</Text>
            </Button>
            <Button onPress={openSettings} testID="settings" class="active:opacity-60 hover:opacity-80">
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
          estimatedItemSize={props.dense ? 68 : 84}
          onRefresh={() => refreshLibrary(true)}
          refreshing={isLoadingLibrary()}
          class="mt-2 flex-1"
          testID="library-list"
        >
          {(item) => (
            <Button
              onPress={() => openArtifact(item())}
              selected={props.selectedId === item().id}
              onContextMenu={(e) => {
                if (hasDesktopMenus) Menu.popup(rowMenu(item()), e.pagePosition);
              }}
              class={`flex-row items-center gap-3 border-b border-border active:bg-muted hover:bg-muted selected:bg-primary/15 ${props.dense ? "px-3 py-2" : "px-4 py-3"}`}
            >
              <TypeTile mark={TYPE_MARK[item().type]} />
              <View class="flex-1 gap-0.5">
                <Text class="font-medium text-foreground" style={{ numberOfLines: 1 }}>
                  {item().title}
                </Text>
                <Text class="text-xs text-muted-foreground" style={{ numberOfLines: 1 }}>
                  {TYPE_LABEL[item().type]} · {item().project.name} · {relativeTime(item().updatedAt)}
                </Text>
                <If when={!props.dense}>
                  <Text class="text-sm text-muted-foreground" style={{ numberOfLines: 1 }}>
                    {item().preview}
                  </Text>
                </If>
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
