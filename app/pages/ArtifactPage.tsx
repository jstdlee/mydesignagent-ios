// One artifact: `ArtifactDetail` keeps it fresh while shown and hands it to the view of its
// type; `ArtifactPage` puts it on the navigation stack, the desktop's pane shows it directly.
import { cleanup, Text, View } from "nsh";
import { NavPage } from "nsh/base";
import { Header } from "../components/Header";
import { TYPE_LABEL } from "../lib/format";
import { artifactById, watchArtifact } from "../lib/store";
import type { ArtifactType } from "../lib/types";
import { ArtboardView } from "./ArtboardView";
import { DocumentView } from "./DocumentView";
import { HtmlView } from "./HtmlView";
import { VerifyView } from "./VerifyView";

export function ArtifactPage(props: { id: string; type: ArtifactType; title: string }) {
  const title = () => artifactById(props.id)?.title ?? props.title;
  return (
    <NavPage title={title()} header={<Header title={title()} />} headerBackTitle="Library">
      <ArtifactDetail id={props.id} type={props.type} />
    </NavPage>
  );
}

export function ArtifactDetail(props: { id: string; type: ArtifactType }) {
  const stop = watchArtifact(props.id);
  cleanup(stop);
  return (
    <If
      when={artifactById(props.id)}
      else={
        <View class="flex-1 items-center justify-center">
          <Text class="text-muted-foreground">Opening {TYPE_LABEL[props.type].toLowerCase()}…</Text>
        </View>
      }
    >
      {(artifact) => {
        switch (props.type) {
          case "artboard":
            return <ArtboardView artifact={artifact()} />;
          case "document":
            return <DocumentView artifact={artifact()} />;
          case "html":
            return <HtmlView artifact={artifact()} />;
          case "verify":
            return <VerifyView artifact={artifact()} />;
        }
      }}
    </If>
  );
}
