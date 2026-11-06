// The app's small set of building blocks. Every page draws from these and the theme tokens,
// so colors follow dark mode and the person's text size.
import { Text, View } from "nsh";
import { Button } from "nsh/base";
import type { JSX } from "nsh";

export function PrimaryButton(props: { label: string; onPress: () => void; disabled?: boolean; testID?: string; class?: string }) {
  return (
    <Button
      onPress={props.onPress}
      disabled={props.disabled}
      testID={props.testID}
      class={`items-center rounded-(--radius) bg-primary px-4 py-3 active:opacity-70 disabled:opacity-40 ${props.class ?? ""}`}
    >
      <Text class="font-semibold text-primary-foreground">{props.label}</Text>
    </Button>
  );
}

export function SecondaryButton(props: { label: string; onPress: () => void; disabled?: boolean; tone?: "danger"; testID?: string; class?: string }) {
  return (
    <Button
      onPress={props.onPress}
      disabled={props.disabled}
      testID={props.testID}
      class={`items-center rounded-(--radius) border px-4 py-3 active:bg-muted disabled:opacity-40 ${props.tone === "danger" ? "border-destructive" : "border-border"} ${props.class ?? ""}`}
    >
      <Text class={props.tone === "danger" ? "font-medium text-destructive" : "font-medium text-foreground"}>{props.label}</Text>
    </Button>
  );
}

/** A choice in a row of filters or segments; `selected` is the app's. */
export function Chip(props: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <Button
      onPress={props.onPress}
      selected={props.selected}
      testID={props.testID}
      class="rounded-full border border-border px-3 py-1.5 active:opacity-70 selected:border-primary selected:bg-primary"
    >
      <Text class={props.selected ? "text-sm font-medium text-primary-foreground" : "text-sm text-foreground"}>{props.label}</Text>
    </Button>
  );
}

export function Badge(props: { label: string; tone?: "accent" | "success" | "danger" | "muted" }) {
  const tone = props.tone ?? "muted";
  const box = { accent: "bg-primary", success: "bg-emerald-600", danger: "bg-destructive", muted: "bg-muted" }[tone];
  const text = tone === "muted" ? "text-muted-foreground" : "text-white";
  return (
    <View class={`rounded-full px-2 py-0.5 ${box}`}>
      <Text class={`text-xs font-semibold ${text}`}>{props.label}</Text>
    </View>
  );
}

export function SectionTitle(props: { title: string; detail?: string }) {
  return (
    <View class="gap-0.5">
      <Text class="text-lg font-semibold text-foreground" role="header">
        {props.title}
      </Text>
      <If when={props.detail}>
        <Text class="text-sm text-muted-foreground">{props.detail}</Text>
      </If>
    </View>
  );
}

export function EmptyState(props: { title: string; message: string; children?: JSX.Element }) {
  return (
    <View class="flex-1 items-center justify-center gap-3 p-8">
      <Text class="text-center text-xl font-semibold text-foreground">{props.title}</Text>
      <Text class="text-center text-muted-foreground">{props.message}</Text>
      <View class="mt-2 w-full max-w-80 gap-2">{props.children}</View>
    </View>
  );
}

/** The type's tile at the start of a row. */
export function TypeTile(props: { mark: string }) {
  return (
    <View class="size-10 items-center justify-center rounded-xl bg-muted">
      <Text class="text-base font-bold text-primary">{props.mark}</Text>
    </View>
  );
}
