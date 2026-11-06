// A live page: a one-page test bench the agent wrote. Its controls (sliders, switches, inputs
// with a `name`) keep their values in the store, so they survive the agent rewriting the page.
import { openUrl, Scroll, signal, Text, View } from "nsh";
import { Button } from "nsh/base";
import { WebFrame } from "../components/WebFrame";
import { connection, loadArtifact, saveState, webUrl } from "../lib/store";
import type { Artifact } from "../lib/types";

type HtmlContent = { type: "html"; title: string; pageUrl?: string; html?: string };

export function HtmlView(props: { artifact: Artifact }) {
  const content = () => props.artifact.content as HtmlContent;
  const reloads = signal(0);
  const values = () => Object.entries(props.artifact.feedback.state);
  // The server's page URL changes when the agent rewrites the page, which loads it again.
  const source = () => ({ url: content().pageUrl ? `${content().pageUrl}#${reloads()}` : undefined, html: content().html });
  return (
    <View class="flex-1 gap-2 pb-[env(safe-area-inset-bottom)]">
      <View class="flex-row items-center gap-4 px-4 pt-2">
        <Button
          onPress={() => {
            reloads.update((n) => n + 1);
            loadArtifact(props.artifact.id, true);
          }}
          class="active:opacity-60"
          testID="reload"
        >
          <Text class="text-primary">Reload</Text>
        </Button>
        <If when={webUrl(content().pageUrl)}>
          <Button onPress={() => openUrl(webUrl(content().pageUrl) ?? "")} class="active:opacity-60">
            <Text class="text-primary">Open in Safari</Text>
          </Button>
        </If>
        <Text class="flex-1 text-right text-xs text-muted-foreground">Values are kept when the agent rewrites the page</Text>
      </View>
      <WebFrame
        source={source()}
        class="mx-4 flex-1"
        testID="live-page"
        onState={(state) => {
          // The server's bridge stores values itself; the demo's page reports them here.
          if (connection()?.mode === "demo") saveState(props.artifact.id, state);
        }}
      />
      <If when={values().length > 0}>
        <Scroll horizontal class="max-h-10" scrollbar={false}>
          <View class="flex-row gap-2 px-4">
            <Each of={values()} key={(v: [string, unknown]) => v[0]}>
              {(entry) => (
                <View class="rounded-full bg-muted px-3 py-1">
                  <Text class="text-xs text-muted-foreground">
                    {entry()[0]}: {String(entry()[1])}
                  </Text>
                </View>
              )}
            </Each>
          </View>
        </Scroll>
      </If>
    </View>
  );
}
