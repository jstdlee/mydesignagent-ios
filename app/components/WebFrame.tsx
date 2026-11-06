// A web view showing one design: a page of the companion server (an artboard option, a side
// of a verify group, a live page) or, in the demo, inline HTML. In comment mode a tap on the
// page reports where it landed as fractions of the page, and existing comments show as pins.
import { Text, View, WebView } from "nsh";
import { webUrl } from "../lib/store";
import type { WebSource } from "../lib/types";

export interface Pin {
  x: number;
  y: number;
  n: number;
}

export interface FrameMessage {
  type: "point" | "state";
  x?: number;
  y?: number;
  values?: Record<string, string | number | boolean>;
}

/** The script the frame runs after each load: draws the pins, and in comment mode reports taps. */
export function frameScript(pins: Pin[], commentMode: boolean): string {
  return `(function () {
  var pins = ${JSON.stringify(pins)};
  var commentMode = ${commentMode ? "true" : "false"};
  function draw() {
    var d = document.documentElement;
    document.querySelectorAll(".__da_pin").forEach(function (p) { p.remove(); });
    pins.forEach(function (p) {
      var el = document.createElement("div");
      el.className = "__da_pin";
      el.textContent = p.n;
      el.style.cssText = "position:absolute;z-index:2147483647;pointer-events:none;width:24px;height:24px;border-radius:12px;" +
        "background:#cf222e;color:#fff;font:600 12px/24px -apple-system,sans-serif;text-align:center;box-shadow:0 1px 4px #0006;" +
        "left:" + (p.x * d.scrollWidth - 12) + "px;top:" + (p.y * d.scrollHeight - 12) + "px";
      document.body.appendChild(el);
    });
  }
  draw();
  window.addEventListener("resize", draw);
  window.addEventListener("load", draw);
  if (commentMode) {
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var d = document.documentElement;
      var msg = { type: "point", x: e.pageX / Math.max(d.scrollWidth, 1), y: e.pageY / Math.max(d.scrollHeight, 1) };
      if (window.nsh && window.nsh.postMessage) window.nsh.postMessage(JSON.stringify(msg));
    }, true);
  }
})(); true;`;
}

export function parseFrameMessage(data: string): FrameMessage | null {
  try {
    const msg = JSON.parse(data);
    if (msg?.type === "point" && typeof msg.x === "number" && typeof msg.y === "number") {
      return { type: "point", x: Math.min(1, Math.max(0, msg.x)), y: Math.min(1, Math.max(0, msg.y)) };
    }
    if (msg?.type === "state" && msg.values && typeof msg.values === "object") return { type: "state", values: msg.values };
  } catch {}
  return null;
}

export function WebFrame(props: {
  source: WebSource;
  height?: number;
  commentMode?: boolean;
  pins?: Pin[];
  onPoint?: (x: number, y: number) => void;
  onState?: (values: Record<string, string | number | boolean>) => void;
  testID?: string;
  class?: string;
}) {
  // A new script needs a new page load, so the frame is made again when the pins or mode change.
  const frameKey = () => `${props.commentMode ? "c" : "v"}:${(props.pins ?? []).map((p) => `${p.x},${p.y}`).join(";")}:${props.source.url ?? ""}`;
  const src = () => webUrl(props.source.url);
  return (
    <View
      class={`overflow-hidden rounded-(--radius) border ${props.commentMode ? "border-primary" : "border-border"} ${props.class ?? ""}`}
      style={props.height ? { height: props.height } : { flex: 1 }}
      testID={props.testID}
    >
      <If
        when={src() || props.source.html}
        else={
          <View class="flex-1 items-center justify-center bg-muted">
            <Text class="text-muted-foreground">Nothing to show yet</Text>
          </View>
        }
      >
        <Each of={[frameKey()]} key={(k: string) => k}>
          {() => (
            <WebView
              src={src() ?? undefined}
              html={src() ? undefined : props.source.html}
              injectedJavaScript={frameScript(props.pins ?? [], Boolean(props.commentMode))}
              onMessage={({ data }) => {
                const msg = parseFrameMessage(data);
                if (msg?.type === "point") props.onPoint?.(msg.x ?? 0, msg.y ?? 0);
                else if (msg?.type === "state" && msg.values) props.onState?.(msg.values);
              }}
              style={{ flex: 1 }}
            />
          )}
        </Each>
      </If>
    </View>
  );
}
