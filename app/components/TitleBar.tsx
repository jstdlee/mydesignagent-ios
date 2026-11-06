// The desktop window's title bar, drawn by the app: it moves the window, leaves room for the
// system's window controls, and holds the search field and the connection status.
import { keymap, Text, View } from "nsh";
import { Button } from "nsh/base";
import { titleBar } from "nsh/desktop";
import { TITLE_BAR_HEIGHT } from "../lib/desktop";
import { artifactById, connection, isOffline, serverInfo } from "../lib/store";
import { currentArtifactId, openSettings } from "../nav";
import { openPalette } from "./CommandPalette";

export function TitleBar() {
  const height = () => titleBar().height || TITLE_BAR_HEIGHT;
  const title = () => {
    const id = currentArtifactId();
    return (id && artifactById(id)?.title) || "Design Agent";
  };
  const status = () => {
    const c = connection();
    if (!c) return { label: "Not connected", tone: "bg-muted-foreground" };
    if (c.mode === "demo") return { label: "Demo", tone: "bg-amber-500" };
    if (isOffline()) return { label: "Offline", tone: "bg-destructive" };
    return { label: c.url.replace(/^https?:\/\//, "") + (serverInfo() ? ` · v${serverInfo()?.version}` : ""), tone: "bg-emerald-500" };
  };
  return (
    <View
      desktop={{ windowDrag: true }}
      class="flex-row items-center gap-3 border-b border-border bg-background"
      style={{ height: height(), paddingLeft: titleBar().left + 12, paddingRight: titleBar().right + 12 }}
      testID="title-bar"
    >
      <Text class="font-semibold text-foreground" style={{ numberOfLines: 1 }}>
        {title()}
      </Text>
      <View class="flex-1 items-center">
        <Button
          onPress={openPalette}
          disabled={!connection()}
          testID="title-search"
          accessibilityLabel="Find artifact"
          class="w-full max-w-md flex-row items-center justify-between rounded-lg border border-border bg-muted px-3 py-1 hover:border-primary disabled:opacity-50"
        >
          <Text class="text-sm text-muted-foreground">Find an artifact or command</Text>
          <Text class="text-xs text-muted-foreground">{keymap.label("mod+k")}</Text>
        </Button>
      </View>
      <Button onPress={openSettings} testID="title-status" class="flex-row items-center gap-2 rounded-full px-2 py-1 hover:bg-muted">
        <View class={`size-2 rounded-full ${status().tone}`} />
        <Text class="text-xs text-muted-foreground" style={{ numberOfLines: 1 }}>
          {status().label}
        </Text>
      </Button>
    </View>
  );
}
