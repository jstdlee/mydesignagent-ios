// The library page of the navigation stack (phones, tablets, narrow desktop windows).
import { Text } from "nsh";
import { Button, NavPage } from "nsh/base";
import { openPalette } from "../components/CommandPalette";
import { Header } from "../components/Header";
import { LibraryBrowser } from "../components/LibraryBrowser";
import { EmptyState, PrimaryButton, SecondaryButton } from "../components/ui";
import { connection, useDemo } from "../lib/store";
import { openSettings } from "../nav";

export function LibraryPage() {
  const searchButton = () => (
    <Button onPress={openPalette} accessibilityLabel="Search" testID="open-palette" class="active:opacity-60">
      <Text class="text-primary">Search</Text>
    </Button>
  );
  return (
    <NavPage
      title="Library"
      headerLargeTitle
      header={<Header title="Library" right={searchButton()} />}
      headerRight={searchButton()}
      ios={{ headerRightSymbol: "magnifyingglass" }}
    >
      <If when={connection()} else={<Welcome />}>
        <LibraryBrowser />
      </If>
    </NavPage>
  );
}

export function Welcome() {
  return (
    <EmptyState
      title="Review what your agent designs"
      message="Pair with designagent-artifacts on your computer to see artboards, documents, live pages and verification rounds from every project."
    >
      <PrimaryButton label="Connect to your computer" onPress={openSettings} testID="connect" />
      <SecondaryButton label="Try the demo workbench" onPress={useDemo} testID="try-demo" />
    </EmptyState>
  );
}
