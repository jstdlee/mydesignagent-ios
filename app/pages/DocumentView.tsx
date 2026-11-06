// A document: design notes, reviews, proposals and walkthroughs, rendered natively from the
// agent's Markdown. Tap a block to comment on it or edit it in place; the agent's own edits
// arrive live, and an edit to a block the agent just rewrote is refused rather than lost.
import { openUrl, Scroll, signal, Text, View } from "nsh";
import { Button, Input, Sheet } from "nsh/base";
import { CommentComposer } from "../components/CommentComposer";
import { CommentList } from "../components/CommentList";
import { PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { inlineSpans } from "../lib/blocks";
import { plural } from "../lib/format";
import { addComment, editBlock, resolveComment } from "../lib/store";
import type { Anchor, Artifact, Comment, DocumentBlock } from "../lib/types";

type DocumentContent = { type: "document"; markdown: string; blocks: DocumentBlock[] };

export function DocumentView(props: { artifact: Artifact }) {
  const blocks = () => (props.artifact.content as DocumentContent).blocks;
  const comments = () => props.artifact.feedback.comments;
  const selected = signal<DocumentBlock | null>(null);
  const editing = signal<{ block: DocumentBlock; text: string } | null>(null);
  const composing = signal<{ anchor: Anchor; about: string } | null>(null);
  const saving = signal(false);

  const commentsOn = (b: DocumentBlock) => comments().filter((c) => c.anchor.kind === "block" && c.anchor.blockId === b.id);
  const orphaned = () => comments().filter((c) => c.anchor.kind === "block" && !blocks().some((b) => b.id === (c.anchor as { blockId: string }).blockId));
  const general = () => comments().filter((c) => c.anchor.kind === "artifact");
  const toggle = (c: Comment) => resolveComment(props.artifact.id, c.id, !c.resolved);

  const save = async () => {
    const e = editing();
    if (!e) return;
    saving.set(true);
    const ok = await editBlock(props.artifact.id, e.block.id, e.text);
    saving.set(false);
    if (ok) editing.set(null);
  };

  return (
    <View class="flex-1">
      <Scroll class="flex-1" testID="document-scroll">
        <View class="gap-1 px-4 pb-16 pt-4">
          <Each of={blocks()} key={(b: DocumentBlock) => b.id}>
            {(block) => (
              <View class="gap-2">
                <Button
                  onPress={() => selected.set(block())}
                  accessibilityHint="Comment on or edit this block"
                  testID={`block-${block().id}`}
                  class={`rounded-lg px-2 py-1.5 active:bg-muted ${commentsOn(block()).some((c) => !c.resolved) ? "bg-primary/10" : ""}`}
                >
                  <BlockText block={block()} />
                </Button>
                <If when={commentsOn(block()).length > 0}>
                  <View class="ml-2 border-l-2 border-primary pl-3">
                    <CommentList comments={commentsOn(block())} onToggle={toggle} />
                  </View>
                </If>
              </View>
            )}
          </Each>

          <View class="mt-8 gap-3">
            <SectionTitle title="On the whole document" detail={general().length ? plural(general().length, "comment") : undefined} />
            <CommentList comments={general()} onToggle={toggle} />
            <If when={orphaned().length > 0}>
              <Text class="text-sm text-muted-foreground">On text the agent has since rewritten:</Text>
              <CommentList comments={orphaned()} onToggle={toggle} />
            </If>
            <SecondaryButton label="Comment on the document" onPress={() => composing.set({ anchor: { kind: "artifact" }, about: props.artifact.title })} />
          </View>
        </View>
      </Scroll>

      <Sheet
        open={selected() !== null}
        onOpenChange={(e) => {
          if (!e.open) selected.set(null);
        }}
        popupClass="gap-3 rounded-t-3xl bg-background p-5 pb-10"
        backdropClass="bg-black/40"
      >
        <Text class="text-sm text-muted-foreground" style={{ numberOfLines: 4 }}>
          {selected()?.text ?? ""}
        </Text>
        <PrimaryButton
          label="Comment on this"
          testID="block-comment"
          onPress={() => {
            const b = selected();
            selected.set(null);
            if (b) composing.set({ anchor: { kind: "block", blockId: b.id, quote: b.text.slice(0, 280) }, about: `“${b.text.slice(0, 140)}”` });
          }}
        />
        <SecondaryButton
          label="Edit text"
          testID="block-edit"
          onPress={() => {
            const b = selected();
            selected.set(null);
            if (b) editing.set({ block: b, text: b.text });
          }}
        />
      </Sheet>

      <Sheet
        open={editing() !== null}
        onOpenChange={(e) => {
          if (!e.open) editing.set(null);
        }}
        popupClass="gap-3 rounded-t-3xl bg-background p-5 pb-10"
        backdropClass="bg-black/40"
      >
        <Text class="text-lg font-semibold text-foreground">Edit block</Text>
        <Text class="text-sm text-muted-foreground">Markdown. The agent sees the change and why it might matter.</Text>
        <Input
          value={editing()?.text ?? ""}
          onChange={({ value }) => editing.update((e) => (e ? { ...e, text: value } : e))}
          multiline
          autoFocus
          autoCapitalize="sentences"
          testID="block-input"
          class="min-h-32 max-h-80 rounded-(--radius) border border-input px-3 py-2 font-mono text-sm text-foreground"
        />
        <View class="flex-row gap-2">
          <SecondaryButton label="Cancel" onPress={() => editing.set(null)} class="flex-1" />
          <PrimaryButton label={saving() ? "Saving…" : "Save"} onPress={save} disabled={saving()} class="flex-1" testID="block-save" />
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

/** One line of Markdown as native text spans: bold, italic, code and links. */
function Inline(props: { line: string; class?: string }) {
  return (
    <Text class={props.class ?? "text-base leading-6 text-foreground"}>
      <Each of={inlineSpans(props.line)}>
        {(span) => (
          <Text
            class={[
              span().bold ? "font-semibold" : "",
              span().italic ? "italic" : "",
              span().code ? "font-mono text-sm bg-muted" : "",
              span().href ? "text-primary underline" : "",
            ].join(" ")}
            onPress={span().href ? () => openUrl(span().href ?? "") : undefined}
          >
            {span().text}
          </Text>
        )}
      </Each>
    </Text>
  );
}

const HEADING_CLASS = ["", "text-3xl font-bold", "text-2xl font-bold", "text-xl font-semibold", "text-lg font-semibold", "text-base font-semibold", "text-base font-semibold"];

function BlockText(props: { block: DocumentBlock }) {
  const lines = () => props.block.text.split("\n");
  switch (props.block.kind) {
    case "heading": {
      const level = () => Math.min(6, props.block.text.match(/^#+/)?.[0].length ?? 1);
      return <Inline line={props.block.text.replace(/^#+\s*/, "")} class={`${HEADING_CLASS[level()]} mt-3 text-foreground`} />;
    }
    case "list":
      return (
        <View class="gap-1">
          <Each of={lines()}>
            {(line) => (
              <View class="flex-row gap-2" style={{ paddingLeft: (line().match(/^\s*/)?.[0].length ?? 0) * 6 }}>
                <Text class="text-base leading-6 text-muted-foreground">{/^\s*\d+[.)]/.test(line()) ? line().trim().match(/^\d+[.)]/)?.[0] : "•"}</Text>
                <View class="flex-1">
                  <Inline line={line().trim().replace(/^([-*+]|\d+[.)])\s+(\[[ x]\]\s*)?/, "")} />
                </View>
              </View>
            )}
          </Each>
        </View>
      );
    case "code":
      return (
        <Scroll horizontal class="rounded-lg bg-muted">
          <Text class="p-3 font-mono text-sm text-foreground">{lines().slice(1, lines()[lines().length - 1].trim().match(/^(```|~~~)/) ? -1 : undefined).join("\n")}</Text>
        </Scroll>
      );
    case "quote":
      return (
        <View class="border-l-4 border-border pl-3">
          <Inline line={lines().map((l) => l.replace(/^>\s?/, "")).join(" ")} class="text-base italic leading-6 text-muted-foreground" />
        </View>
      );
    case "table":
      return (
        <Scroll horizontal>
          <Text class="font-mono text-sm text-foreground">{lines().filter((l) => !/^\|?\s*:?-{2,}/.test(l)).join("\n")}</Text>
        </Scroll>
      );
    case "rule":
      return <View class="my-2 h-px bg-border" />;
    default:
      return <Inline line={lines().join(" ")} />;
  }
}
