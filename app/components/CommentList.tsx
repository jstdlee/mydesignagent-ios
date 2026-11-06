// The comments on one part of an artifact, oldest first, each marked done or open.
import { Text, View } from "nsh";
import { Button } from "nsh/base";
import { percent, relativeTime } from "../lib/format";
import type { Comment } from "../lib/types";

export function CommentList(props: { comments: Comment[]; onToggle: (comment: Comment) => void }) {
  return (
    <View class="gap-2">
      <Each of={props.comments} key={(c: Comment) => c.id}>
        {(comment) => (
          <View class="flex-row items-start gap-3 rounded-(--radius) bg-muted p-3">
            <View class="flex-1 gap-1">
              <Text class={comment().resolved ? "text-muted-foreground line-through" : "text-foreground"}>{comment().body}</Text>
              <Text class="text-xs text-muted-foreground">
                {pinLabel(comment())}
                {relativeTime(comment().at)}
              </Text>
            </View>
            <Button
              onPress={() => props.onToggle(comment())}
              accessibilityLabel={comment().resolved ? "Reopen comment" : "Mark comment done"}
              class="rounded-full border border-border px-2 py-1 active:opacity-60"
            >
              <Text class="text-xs text-foreground">{comment().resolved ? "Reopen" : "Done"}</Text>
            </Button>
          </View>
        )}
      </Each>
    </View>
  );
}

function pinLabel(c: Comment): string {
  const a = c.anchor;
  if ((a.kind === "option" || a.kind === "group") && a.x !== undefined && a.y !== undefined) return `Pinned at ${percent(a.x)}, ${percent(a.y)} · `;
  return "";
}
