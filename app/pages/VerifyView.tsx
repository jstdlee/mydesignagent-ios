// Verify: what the agent built, next to the design the person approved. Each group passes,
// or is rejected with a note saying what to fix; the agent reads the verdicts and comes back
// with the group fixed.
import { Scroll, signal, Text, View, windowSize } from "nsh";
import { Input, Sheet } from "nsh/base";
import { CommentComposer } from "../components/CommentComposer";
import { CommentList } from "../components/CommentList";
import { type Pin, WebFrame } from "../components/WebFrame";
import { Badge, Chip, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { percent, plural } from "../lib/format";
import { addComment, resolveComment, setVerdict } from "../lib/store";
import type { Anchor, Artifact, Comment, VerifyGroup } from "../lib/types";

type VerifyContent = { type: "verify"; brief: string; groups: VerifyGroup[] };
type Layout = "both" | "design" | "built";

export function VerifyView(props: { artifact: Artifact }) {
  const content = () => props.artifact.content as VerifyContent;
  const feedback = () => props.artifact.feedback;
  const wide = () => windowSize().width >= 700;
  const layout = signal<Layout>("both");
  const commentMode = signal(false);
  const rejecting = signal<{ group: VerifyGroup; note: string } | null>(null);
  const composing = signal<{ anchor: Anchor; about: string } | null>(null);

  const verdictOf = (g: VerifyGroup) => feedback().verdicts[g.id];
  const pending = () => content().groups.filter((g) => !verdictOf(g)).length;
  const commentsOn = (g: VerifyGroup) => feedback().comments.filter((c) => c.anchor.kind === "group" && c.anchor.groupId === g.id);
  const pins = (g: VerifyGroup): Pin[] =>
    commentsOn(g)
      .filter((c) => c.anchor.kind === "group" && c.anchor.x !== undefined && !c.resolved)
      .map((c, i) => ({ x: (c.anchor as { x: number }).x, y: (c.anchor as { y: number }).y, n: i + 1 }));

  const reject = async () => {
    const r = rejecting();
    if (!r?.note.trim()) return;
    if (await setVerdict(props.artifact.id, r.group.id, "reject", r.note)) rejecting.set(null);
  };

  return (
    <View class="flex-1">
      <Scroll class="flex-1" testID="verify-scroll">
        <View class="gap-6 px-4 pb-16 pt-4">
          <If when={content().brief}>
            <Text class="text-base text-muted-foreground">{content().brief}</Text>
          </If>
          <View class="gap-2">
            <Text class="text-sm text-muted-foreground">
              {pending() ? `${plural(pending(), "group")} waiting for a verdict` : "Every group has a verdict"}
            </Text>
            <View class="flex-row flex-wrap gap-2">
              <Chip label={wide() ? "Side by side" : "Both"} selected={layout() === "both"} onPress={() => layout.set("both")} />
              <Chip label="Design" selected={layout() === "design"} onPress={() => layout.set("design")} />
              <Chip label="Built" selected={layout() === "built"} onPress={() => layout.set("built")} />
              <Chip label="Comment on pixels" selected={commentMode()} onPress={() => commentMode.update((v) => !v)} />
            </View>
          </View>

          <Each of={content().groups} key={(g: VerifyGroup) => g.id}>
            {(group) => (
              <View class="gap-3" testID={`group-${group().id}`}>
                <View class="flex-row items-center gap-2">
                  <View class="flex-1">
                    <SectionTitle title={group().title ?? group().id} detail={group().notes} />
                  </View>
                  <If when={verdictOf(group())}>
                    {(v) => <Badge label={v().verdict === "pass" ? "Passed" : "Rejected"} tone={v().verdict === "pass" ? "success" : "danger"} />}
                  </If>
                </View>
                <View class={wide() && layout() === "both" ? "flex-row gap-3" : "gap-3"}>
                  <If when={layout() !== "built"}>
                    <Side
                      label="Approved design"
                      group={group()}
                      side="design"
                      wide={wide() && layout() === "both"}
                      commentMode={commentMode()}
                      pins={[]}
                      onPoint={() => {}}
                    />
                  </If>
                  <If when={layout() !== "design"}>
                    <Side
                      label="Built"
                      group={group()}
                      side="built"
                      wide={wide() && layout() === "both"}
                      commentMode={commentMode()}
                      pins={pins(group())}
                      onPoint={(x, y) =>
                        composing.set({ anchor: { kind: "group", groupId: group().id, x, y }, about: `${group().title ?? group().id}, built, at ${percent(x)} across and ${percent(y)} down` })
                      }
                    />
                  </If>
                </View>
                <If when={verdictOf(group())?.note}>
                  <Text class="text-sm text-destructive">Fix: {verdictOf(group())?.note}</Text>
                </If>
                <CommentList comments={commentsOn(group())} onToggle={(c: Comment) => resolveComment(props.artifact.id, c.id, !c.resolved)} />
                <View class="flex-row gap-2">
                  <PrimaryButton label="Pass" onPress={() => setVerdict(props.artifact.id, group().id, "pass", "")} class="flex-1" testID={`pass-${group().id}`} />
                  <SecondaryButton label="Reject" tone="danger" onPress={() => rejecting.set({ group: group(), note: "" })} class="flex-1" testID={`reject-${group().id}`} />
                </View>
              </View>
            )}
          </Each>
        </View>
      </Scroll>

      <Sheet
        open={rejecting() !== null}
        onOpenChange={(e) => {
          if (!e.open) rejecting.set(null);
        }}
        popupClass="gap-3 rounded-t-3xl bg-background p-5 pb-10"
        backdropClass="bg-black/40"
      >
        <Text class="text-lg font-semibold text-foreground">Reject “{rejecting()?.group.title ?? rejecting()?.group.id}”</Text>
        <Text class="text-sm text-muted-foreground">Say what differs from the design. The agent fixes it and sends the group back.</Text>
        <Input
          value={rejecting()?.note ?? ""}
          onChange={({ value }) => rejecting.update((r) => (r ? { ...r, note: value } : r))}
          placeholder="The rows are 2pt tighter than the design"
          multiline
          autoFocus
          testID="reject-note"
          class="min-h-24 rounded-(--radius) border border-input px-3 py-2 text-foreground"
        />
        <View class="flex-row gap-2">
          <SecondaryButton label="Cancel" onPress={() => rejecting.set(null)} class="flex-1" />
          <PrimaryButton label="Reject" onPress={reject} disabled={!rejecting()?.note.trim()} class="flex-1" testID="reject-send" />
        </View>
      </Sheet>

      <CommentComposer
        open={composing() !== null}
        about={composing()?.about ?? ""}
        onSend={(body) => addComment(props.artifact.id, composing()?.anchor ?? { kind: "artifact" }, body)}
        onClose={() => composing.set(null)}
      />
    </View>
  );
}

function Side(props: {
  label: string;
  group: VerifyGroup;
  side: "design" | "built";
  wide: boolean;
  commentMode: boolean;
  pins: Pin[];
  onPoint: (x: number, y: number) => void;
}) {
  return (
    <View class={props.wide ? "flex-1 gap-1" : "gap-1"}>
      <Text class="text-xs font-semibold uppercase text-muted-foreground">{props.label}</Text>
      <WebFrame
        source={props.group[props.side]}
        height={360}
        commentMode={props.commentMode && props.side === "built"}
        pins={props.pins}
        onPoint={props.onPoint}
        testID={`${props.side}-${props.group.id}`}
      />
    </View>
  );
}
