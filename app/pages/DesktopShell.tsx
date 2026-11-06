// The desktop layout: the library in a sidebar, the selected artifact (or the connection
// settings) in the pane beside it. The same views as on the phone, with room to see the
// library and an artifact at once.
import { Text, View } from "nsh";
import { Button } from "nsh/base";
import { openPalette } from "../components/CommandPalette";
import { LibraryBrowser } from "../components/LibraryBrowser";
import { Badge } from "../components/ui";
import { relativeTime, TYPE_LABEL } from "../lib/format";
import { artifactById, connection } from "../lib/store";
import type { ArtifactType } from "../lib/types";
import { pane, type Route } from "../nav";
import { ArtifactDetail } from "./ArtifactPage";
import { Welcome } from "./Library";
import { SettingsForm } from "./Settings";

const routeKey = (r: Route) => (r.name === "artifact" ? `artifact:${r.id}` : r.name);

export function DesktopShell() {
  const selectedId = () => {
    const p = pane();
    return p.name === "artifact" ? p.id : null;
  };
  return (
    <If
      when={connection()}
      else={
        <If when={pane().name === "settings"} else={<Welcome />}>
          <SettingsForm />
        </If>
      }
    >
      <View class="flex-1 flex-row">
        <View class="w-80 border-r border-border" testID="sidebar">
          <LibraryBrowser dense selectedId={selectedId()} />
        </View>
        <View class="flex-1" testID="detail-pane">
          {/* One pane per route: switching artifacts starts the next one fresh and stops watching the last. */}
          <Each of={[pane()]} key={routeKey}>
            {(route) => <Pane route={route()} />}
          </Each>
        </View>
      </View>
    </If>
  );
}

function Pane(props: { route: Route }) {
  const route = props.route;
  switch (route.name) {
    case "settings":
      return <SettingsForm />;
    case "artifact":
      return (
        <View class="flex-1">
          <PaneHeader id={route.id} type={route.type} title={route.title} />
          <ArtifactDetail id={route.id} type={route.type} />
        </View>
      );
    default:
      return (
        <View class="flex-1 items-center justify-center gap-3 p-8">
          <Text class="text-xl font-semibold text-foreground">Select an artifact</Text>
          <Text class="text-center text-muted-foreground">Choose one in the library, or find it by name.</Text>
          <Button onPress={openPalette} class="rounded-(--radius) border border-border px-4 py-2 hover:bg-muted active:bg-muted">
            <Text class="text-primary">Find an artifact…</Text>
          </Button>
        </View>
      );
  }
}

function PaneHeader(props: { id: string; type: ArtifactType; title: string }) {
  const artifact = () => artifactById(props.id);
  return (
    <View class="flex-row items-center gap-3 border-b border-border px-5 py-3">
      <View class="flex-1 gap-0.5">
        <Text class="text-lg font-semibold text-foreground" style={{ numberOfLines: 1 }} role="header">
          {artifact()?.title ?? props.title}
        </Text>
        <Text class="text-xs text-muted-foreground" style={{ numberOfLines: 1 }}>
          {TYPE_LABEL[props.type]}
          {artifact() ? ` · ${artifact()?.project.name} · ${artifact()?.type}/${artifact()?.slug} · updated ${relativeTime(artifact()?.updatedAt ?? "")}` : ""}
        </Text>
      </View>
      <If when={(artifact()?.stats.pending ?? 0) > 0}>
        <Badge label={`${artifact()?.stats.pending} waiting for the agent`} tone="accent" />
      </If>
    </View>
  );
}
