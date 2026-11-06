// The app shell: restores the connection, starts live sync, and lays the app out for the
// device - a navigation stack on phones, tablets and narrow windows; a title bar, sidebar and
// detail pane on wide desktop windows. Pages own everything else.
import { keymap, mount, Text, View } from "nsh";
import { NavStack } from "nsh/base";
import { isAvailable as isDesktopWindow } from "nsh/desktop";
import { CommandPalette, openPalette } from "./components/CommandPalette";
import { TitleBar } from "./components/TitleBar";
import { installDesktop } from "./lib/desktop";
import { connection, restoreConnection, startSync, toast } from "./lib/store";
import { isSplitLayout, nav } from "./nav";
import { ArtifactPage } from "./pages/ArtifactPage";
import { DesktopShell } from "./pages/DesktopShell";
import { LibraryPage } from "./pages/Library";
import { SettingsPage } from "./pages/Settings";

restoreConnection();
startSync();
if (isDesktopWindow) installDesktop();

function App() {
  // ⌘K / Ctrl+K: on desktops the File menu has it too; this covers iPad keyboards.
  keymap.bind("mod+k", () => {
    if (connection()) openPalette();
  });
  return (
    <View class="flex-1 bg-background">
      <If when={isDesktopWindow}>
        <TitleBar />
      </If>
      <If
        when={isSplitLayout()}
        else={
          <NavStack state={nav} class="flex-1">
            {(route) => {
              switch (route.name) {
                case "library":
                  return <LibraryPage />;
                case "artifact":
                  return <ArtifactPage id={route.id} type={route.type} title={route.title} />;
                case "settings":
                  return <SettingsPage />;
              }
            }}
          </NavStack>
        }
      >
        <DesktopShell />
      </If>
      <CommandPalette />
      <If when={toast()}>
        {(t) => (
          <View class="pointer-events-none absolute inset-x-4 bottom-0 items-center pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <View class={`rounded-2xl px-4 py-3 shadow-lg ${t().tone === "error" ? "bg-destructive" : "bg-foreground"}`}>
              <Text class={t().tone === "error" ? "text-white" : "text-background"} testID="toast">
                {t().text}
              </Text>
            </View>
          </View>
        )}
      </If>
    </View>
  );
}

mount(App);
