// The page's header on the desktops and the web; iOS and Android show the system's, from the page's `title`.
import { Text, View } from "nsh";
import { Button } from "nsh/base";
import type { JSX } from "nsh";
import { nav } from "../nav";

export function Header(props: { title: string; right?: JSX.Element }) {
  return (
    <View class="flex-row items-center gap-3 border-b border-border px-4 py-3">
      <If when={nav.routes().length > 1}>
        <Button onPress={() => nav.pop()} class="active:opacity-60" accessibilityLabel="Back">
          <Text class="text-primary">Back</Text>
        </Button>
      </If>
      <Text class="flex-1 font-semibold text-foreground" style={{ numberOfLines: 1 }}>
        {props.title}
      </Text>
      {props.right}
    </View>
  );
}
