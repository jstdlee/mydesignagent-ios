// An artboard: each question's options side by side, drawn live from the agent's HTML. The
// person picks options, pins comments on any point of a design, and submits the round, which
// the agent reads as "q1 → b" with the brief and the comments.
import { Scroll, signal, Text, View, windowSize } from "nsh";
import { Button, Input } from "nsh/base";
import { CommentComposer } from "../components/CommentComposer";
import { CommentList } from "../components/CommentList";
import { type Pin, WebFrame } from "../components/WebFrame";
import { Chip, PrimaryButton, SecondaryButton, SectionTitle } from "../components/ui";
import { percent, plural, relativeTime } from "../lib/format";
import { addComment, pickOptions, resolveComment, submitRound } from "../lib/store";
import type { Anchor, Artifact, ArtboardOption, ArtboardQuestion, Comment } from "../lib/types";

type ArtboardContent = { type: "artboard"; brief: string; questions: ArtboardQuestion[] };

export function ArtboardView(props: { artifact: Artifact }) {
  const content = () => props.artifact.content as ArtboardContent;
  const feedback = () => props.artifact.feedback;
  const commentMode = signal(false);
  const composing = signal<{ anchor: Anchor; about: string } | null>(null);
  const brief = signal("");
  const notes = signal<Record<string, string>>({});
  const submitting = signal(false);
  // Two cards and a peek of the third on a phone; wider cards on an iPad.
  const cardWidth = () => Math.max(260, Math.min(windowSize().width - 64, 440));

  const picked = (q: ArtboardQuestion) => feedback().answers[q.id]?.optionIds ?? [];
  const noteFor = (q: ArtboardQuestion) => notes()[q.id] ?? feedback().answers[q.id]?.note ?? "";
  const toggle = (q: ArtboardQuestion, optionId: string) => {
    const current = picked(q);
    const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : q.multiple ? [...current, optionId] : [optionId];
    pickOptions(props.artifact.id, q.id, next, noteFor(q));
  };
  const saveNote = (q: ArtboardQuestion) => {
    if (notes()[q.id] === undefined) return;
    pickOptions(props.artifact.id, q.id, picked(q), noteFor(q));
  };
  const commentsOn = (q: ArtboardQuestion) =>
    feedback().comments.filter((c) => c.anchor.kind === "option" && c.anchor.questionId === q.id);
  const generalComments = () => feedback().comments.filter((c) => c.anchor.kind === "artifact");
  const unanswered = () => content().questions.filter((q) => picked(q).length === 0).length;
  const lastRound = () => feedback().rounds.at(-1);

  const submit = async () => {
    submitting.set(true);
    if (await submitRound(props.artifact.id, brief())) brief.set("");
    submitting.set(false);
  };

  return (
    <View class="flex-1">
      <Scroll class="flex-1" keyboardDismissMode="interactive" testID="artboard-scroll">
        <View class="gap-6 px-4 pb-16 pt-4">
          <If when={content().brief}>
            <Text class="text-base text-muted-foreground">{content().brief}</Text>
          </If>
          <View class="flex-row items-center justify-between gap-3">
            <Text class="flex-1 text-sm text-muted-foreground">
              {commentMode() ? "Tap any point of a design to pin a comment there." : "Pick an option for each question, then submit the round."}
            </Text>
            <Chip label="Comment on pixels" selected={commentMode()} onPress={() => commentMode.update((v) => !v)} testID="comment-mode" />
          </View>

          <Each of={content().questions} key={(q: ArtboardQuestion) => q.id}>
            {(question) => (
              <View class="gap-3">
                <SectionTitle
                  title={`${question().id}. ${question().prompt ?? "Choose an option"}`}
                  detail={question().multiple ? "Pick any that work" : "Pick one"}
                />
                <Scroll horizontal class="-mx-4" scrollbar={false} snapToInterval={cardWidth() + 12} decelerationRate="fast">
                  <View class="flex-row gap-3 px-4">
                    <Each of={question().options} key={(o: ArtboardOption) => o.id}>
                      {(option) => (
                        <OptionCard
                          question={question()}
                          option={option()}
                          width={cardWidth()}
                          picked={picked(question()).includes(option().id)}
                          commentMode={commentMode()}
                          comments={commentsOn(question()).filter((c) => c.anchor.kind === "option" && c.anchor.optionId === option().id)}
                          onPick={() => toggle(question(), option().id)}
                          onComment={(x, y) =>
                            composing.set({
                              anchor: { kind: "option", questionId: question().id, optionId: option().id, x, y },
                              about:
                                x === undefined
                                  ? `${question().id} → ${option().id} (${option().title ?? option().id})`
                                  : `${question().id} → ${option().id}, at ${percent(x)} across and ${percent(y)} down`,
                            })
                          }
                        />
                      )}
                    </Each>
                  </View>
                </Scroll>
                <Input
                  value={noteFor(question())}
                  onChange={({ value }) => notes.update((n) => ({ ...n, [question().id]: value }))}
                  onSubmit={() => saveNote(question())}
                  onBlur={() => saveNote(question())}
                  placeholder={`A note on ${question().id} (optional)`}
                  class="rounded-(--radius) border border-input px-3 py-2 text-foreground"
                />
                <CommentList comments={commentsOn(question())} onToggle={(c: Comment) => resolveComment(props.artifact.id, c.id, !c.resolved)} />
              </View>
            )}
          </Each>

          <View class="gap-3">
            <SectionTitle title="On the whole artboard" />
            <CommentList comments={generalComments()} onToggle={(c: Comment) => resolveComment(props.artifact.id, c.id, !c.resolved)} />
            <SecondaryButton
              label="Add a comment"
              onPress={() => composing.set({ anchor: { kind: "artifact" }, about: props.artifact.title })}
              testID="comment-artboard"
            />
          </View>

          <View class="gap-3 rounded-2xl bg-muted p-4">
            <SectionTitle
              title={lastRound() ? `Round ${(lastRound()?.n ?? 0) + 1}` : "Submit the round"}
              detail={
                lastRound()
                  ? `Round ${lastRound()?.n} went to the agent ${relativeTime(lastRound()?.at ?? "")}.`
                  : unanswered()
                    ? `${plural(unanswered(), "question")} without a pick yet.`
                    : "Every question has a pick."
              }
            />
            <Input
              value={brief()}
              onChange={({ value }) => brief.set(value)}
              placeholder="Anything the agent should know for the next round"
              multiline
              testID="round-brief"
              class="min-h-16 rounded-(--radius) border border-input bg-background px-3 py-2 text-foreground"
            />
            <PrimaryButton label={submitting() ? "Sending…" : "Submit round"} onPress={submit} disabled={submitting()} testID="submit-round" />
          </View>
        </View>
      </Scroll>
      <CommentComposer
        open={composing() !== null}
        about={composing()?.about ?? ""}
        onSend={(body) => addComment(props.artifact.id, composing()?.anchor ?? { kind: "artifact" }, body)}
        onClose={() => composing.set(null)}
      />
    </View>
  );
}

function OptionCard(props: {
  question: ArtboardQuestion;
  option: ArtboardOption;
  width: number;
  picked: boolean;
  commentMode: boolean;
  comments: Comment[];
  onPick: () => void;
  onComment: (x?: number, y?: number) => void;
}) {
  const pins = (): Pin[] =>
    props.comments
      .filter((c) => c.anchor.kind === "option" && c.anchor.x !== undefined && !c.resolved)
      .map((c, i) => ({ x: (c.anchor as { x: number }).x, y: (c.anchor as { y: number }).y, n: i + 1 }));
  return (
    <View class={`gap-2 rounded-2xl border-2 p-2 ${props.picked ? "border-primary" : "border-transparent"}`} style={{ width: props.width }}>
      <View class="flex-row items-center gap-2 px-1">
        <View class="size-7 items-center justify-center rounded-full bg-muted">
          <Text class="text-sm font-bold text-foreground">{props.option.id}</Text>
        </View>
        <View class="flex-1">
          <Text class="font-medium text-foreground" style={{ numberOfLines: 1 }}>
            {props.option.title ?? props.option.id}
          </Text>
          <If when={props.option.description}>
            <Text class="text-xs text-muted-foreground" style={{ numberOfLines: 1 }}>
              {props.option.description}
            </Text>
          </If>
        </View>
        <Button
          onPress={props.onPick}
          selected={props.picked}
          accessibilityLabel={`${props.picked ? "Unpick" : "Pick"} ${props.question.id} ${props.option.id}`}
          testID={`pick-${props.question.id}-${props.option.id}`}
          class="rounded-full border border-primary px-3 py-1 active:opacity-60 selected:bg-primary"
        >
          <Text class={props.picked ? "text-sm font-semibold text-primary-foreground" : "text-sm text-primary"}>{props.picked ? "Picked" : "Pick"}</Text>
        </Button>
      </View>
      <WebFrame
        source={props.option}
        height={380}
        commentMode={props.commentMode}
        pins={pins()}
        onPoint={(x, y) => props.onComment(x, y)}
        testID={`frame-${props.question.id}-${props.option.id}`}
      />
      <Button onPress={() => props.onComment()} class="self-start px-1 py-1 active:opacity-60" testID={`comment-${props.question.id}-${props.option.id}`}>
        <Text class="text-sm text-primary">{props.comments.length ? `${plural(props.comments.length, "comment")} · Add` : "Comment"}</Text>
      </Button>
    </View>
  );
}
