// Pairing: the address and key `designagent-artifacts pair` prints on the computer, typed in
// or pasted as a designagent://pair link. The key is checked against the server before it is saved.
import { Clipboard, platform, Scroll, signal, Text, View } from "nsh";
import { Input, NavPage } from "nsh/base";
import { Header } from "../components/Header";
import { PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { parsePairingLink } from "../lib/backend";
import { connect, connection, disconnect, refreshLibrary, serverInfo, useDemo } from "../lib/store";
import { closeSettings } from "../nav";

export function SettingsPage() {
  return (
    <NavPage title="Connection" header={<Header title="Connection" />}>
      <SettingsForm />
    </NavPage>
  );
}

/** The pairing form: the stack's Connection page, and the desktop pane's. */
export function SettingsForm() {
  const address = signal(connection()?.mode === "server" ? (connection()?.url ?? "") : "");
  const key = signal(connection()?.mode === "server" ? (connection()?.key ?? "") : "");
  const error = signal("");
  const busy = signal(false);

  const submit = async () => {
    busy.set(true);
    error.set("");
    const problem = await connect(address(), key());
    busy.set(false);
    if (problem) error.set(problem);
    else closeSettings();
  };

  const paste = async () => {
    const text = await Clipboard.readText();
    const link = parsePairingLink(text);
    if (link) {
      address.set(link.url);
      key.set(link.key);
      error.set("");
    } else error.set("The clipboard does not hold a designagent://pair link.");
  };

  const status = () => {
    const c = connection();
    if (!c) return "Not connected";
    if (c.mode === "demo") return "Using the demo workbench";
    return `Connected to ${c.url}${serverInfo() ? ` (designagent-artifacts ${serverInfo()?.version})` : ""}`;
  };

  return (
      <Scroll class="flex-1" keyboardDismissMode="interactive">
        <View class={`w-full max-w-xl gap-6 p-4 pb-16 ${platform.desktop ? "self-center pt-8" : ""}`}>
          <View class="gap-1">
            <Text class="text-base font-medium text-foreground" testID="connection-status">
              {status()}
            </Text>
          </View>

          <View class="gap-3">
            <SectionTitle title="Pair with your computer" detail="On the computer that runs your coding agent:" />
            <View class="gap-1 rounded-(--radius) bg-muted p-3">
              <Text class="font-mono text-sm text-foreground">designagent-artifacts start --host 0.0.0.0</Text>
              <Text class="font-mono text-sm text-foreground">designagent-artifacts pair</Text>
            </View>
            <Text class="text-sm text-muted-foreground">Then copy the pairing link to this phone, or type the address and key it prints. The phone and the computer need to be on the same network.</Text>
            <SecondaryButton label="Paste pairing link" onPress={paste} testID="paste-link" />
            <Input
              value={address()}
              onChange={({ value }) => address.set(value)}
              placeholder="Address, e.g. 192.168.1.20:27419"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              testID="address"
              class="rounded-(--radius) border border-input px-3 py-2.5 text-foreground"
            />
            <Input
              value={key()}
              onChange={({ value }) => key.set(value)}
              placeholder="Key"
              masked
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmit={submit}
              testID="key"
              class="rounded-(--radius) border border-input px-3 py-2.5 text-foreground"
            />
            <If when={error()}>
              <Text class="text-sm text-destructive" testID="connection-error">
                {error()}
              </Text>
            </If>
            <PrimaryButton label={busy() ? "Connecting…" : "Connect"} onPress={submit} disabled={busy() || !address().trim() || !key().trim()} testID="connect-submit" />
          </View>

          <View class="gap-3">
            <SectionTitle title="Other ways in" />
            <SecondaryButton
              label="Use the demo workbench"
              onPress={() => {
                useDemo();
                closeSettings();
              }}
              testID="use-demo"
            />
            <If when={connection()}>
              <SecondaryButton label="Refresh the library" onPress={() => refreshLibrary(true)} />
              <SecondaryButton label="Disconnect" tone="danger" onPress={disconnect} testID="disconnect" />
            </If>
          </View>
        </View>
      </Scroll>
  );
}
