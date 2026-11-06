// The app shell: restores the connection, starts live sync, and hosts the navigation stack
// and the toast. Pages own everything else.
import { mount, Text, View } from "nsh";
import { NavStack } from "nsh/base";
import { restoreConnection, startSync, toast } from "./lib/store";
import { nav } from "./nav";
import { ArtifactPage } from "./pages/ArtifactPage";
import { LibraryPage } from "./pages/Library";
import { SettingsPage } from "./pages/Settings";

restoreConnection();
startSync();

function App() {
  return (
    <View class="flex-1 bg-background">
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
