// A sheet for writing one comment. The page owns what it is about (`about`) and whether it
// is open; the composer owns the draft while it is open.
import { signal, Text, View } from "nsh";
import { Input, Sheet } from "nsh/base";
import { PrimaryButton, SecondaryButton } from "./ui";

export function CommentComposer(props: {
  open: boolean;
  about: string;
  placeholder?: string;
  /** Sends the comment; resolves true once the server took it. */
  onSend: (body: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const draft = signal("");
  const sending = signal(false);
  const send = async () => {
    if (!draft().trim() || sending()) return;
    sending.set(true);
    const ok = await props.onSend(draft());
    sending.set(false);
    if (ok) {
      draft.set("");
      props.onClose();
    }
  };
  return (
    <Sheet
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
      popupClass="gap-3 rounded-t-3xl bg-background p-5 pb-10"
      backdropClass="bg-black/40"
    >
      <Text class="text-lg font-semibold text-foreground">Comment</Text>
      <Text class="text-sm text-muted-foreground" style={{ numberOfLines: 3 }}>
        {props.about}
      </Text>
      <Input
        value={draft()}
        onChange={({ value }) => draft.set(value)}
        placeholder={props.placeholder ?? "What should the agent change?"}
        multiline
        autoFocus
        testID="comment-input"
        class="min-h-24 rounded-(--radius) border border-input px-3 py-2 text-foreground"
      />
      <View class="flex-row gap-2">
        <SecondaryButton label="Cancel" onPress={props.onClose} class="flex-1" />
        <PrimaryButton label={sending() ? "Sending…" : "Send"} onPress={send} disabled={!draft().trim() || sending()} class="flex-1" />
      </View>
    </Sheet>
  );
}
