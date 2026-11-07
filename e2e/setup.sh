#!/usr/bin/env bash
# Creates a project with artifacts as an agent would, starts the server, writes config.json.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cli="node $here/../server/bin/designagent-artifacts.js"
export DESIGNAGENT_SERVER_HOME="${DESIGNAGENT_SERVER_HOME:-$(mktemp -d)}"
project="${E2E_PROJECT:-$(mktemp -d)}"
mkdir -p "$project/.git"

$cli new artboard header-options --title "Header options" --project-dir "$project" --quiet
cat > "$project/.designagent/artifacts/artboard/header-options/artboard.json" <<'JSON'
{
  "brief": "Which header should the library use?",
  "questions": [
    {
      "id": "q1",
      "prompt": "Header height",
      "options": [
        { "id": "a", "title": "Tall", "html": "<header style='height:120px;background:#0969da'></header>" },
        { "id": "b", "title": "Compact", "html": "<header style='height:56px;background:#0969da'></header>" }
      ]
    }
  ]
}
JSON

$cli new document settings-notes --title "Settings notes" --project-dir "$project" --quiet
printf '# Settings notes\n\nSettings open from the library header.\n\nThey hold the connection.\n' \
  > "$project/.designagent/artifacts/document/settings-notes/document.md"

$cli new verify built-header --title "Built header" --project-dir "$project" --quiet
$cli start --project-dir "$project" --quiet
port=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1])).port)" "$DESIGNAGENT_SERVER_HOME/server-info.json")
key=$(tr -d '\n' < "$DESIGNAGENT_SERVER_HOME/key")
printf '{ "address": "http://127.0.0.1:%s", "key": "%s" }\n' "$port" "$key" > "$here/config.json"

# The agent edits the document later, while the app shows it.
( sleep "${AGENT_EDIT_AFTER:-45}"; printf '\nAdded by the agent while you were reading.\n' \
    >> "$project/.designagent/artifacts/document/settings-notes/document.md" ) </dev/null >/dev/null 2>&1 &

echo "project=$project"
echo "DESIGNAGENT_SERVER_HOME=$DESIGNAGENT_SERVER_HOME"
