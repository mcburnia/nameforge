#!/usr/bin/env bash
# Session capture script for NameForge
# Called automatically by .claude/hooks.json on SessionEnd.
# Reads the session transcript from stdin (hook input), converts it to markdown,
# saves it as session.md in the project root, and archives a timestamped copy
# to the evidence repo configured in .claude/.env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load evidence config
if [ -f "$PROJECT_DIR/.claude/.env" ]; then
  source "$PROJECT_DIR/.claude/.env"
else
  echo "ERROR: .claude/.env not found" >&2
  exit 1
fi

if [ -z "${EVIDENCE_REPO:-}" ] || [ -z "${PROJECT_NAME:-}" ]; then
  echo "ERROR: EVIDENCE_REPO and PROJECT_NAME must be set in .claude/.env" >&2
  exit 1
fi

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Extract transcript path and session ID from hook input
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('transcript_path',''))" 2>/dev/null || echo "")
SESSION_ID=$(echo "$HOOK_INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null || echo "")

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  echo "WARNING: No transcript path available or file not found: $TRANSCRIPT_PATH" >&2
  exit 0
fi

TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
DATE_DISPLAY=$(date +%Y-%m-%d)
TIME_DISPLAY=$(date +%H:%M:%S)

# Convert JSONL transcript to markdown using Python
python3 << 'PYTHON_SCRIPT' - "$TRANSCRIPT_PATH" "$SESSION_ID" "$PROJECT_NAME" "$DATE_DISPLAY" "$TIME_DISPLAY" "$PROJECT_DIR/session.md"
import json
import sys
import os

transcript_path = sys.argv[1]
session_id = sys.argv[2]
project_name = sys.argv[3]
date_display = sys.argv[4]
time_display = sys.argv[5]
output_path = sys.argv[6]

frontmatter = f"""---
project: {project_name}
client: internal
contributor: Andi McBurnie
date: {date_display}
time: {time_display}
session_id: {session_id}
tool: Claude Code
type: development_session
---

# Development Session — {date_display} {time_display}

**Project:** {project_name}
**Client:** Internal
**Contributor:** Andi McBurnie
**Date:** {date_display} {time_display}
**Session ID:** {session_id}

---

"""

transcript_lines = []

with open(transcript_path, 'r') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_type = msg.get('type', '')
        role = msg.get('role', '')

        # Handle conversation messages
        if msg_type == 'human' or role == 'human' or role == 'user':
            content = ''
            if isinstance(msg.get('message'), dict):
                # Extract text from message content
                for part in msg['message'].get('content', []):
                    if isinstance(part, str):
                        content += part
                    elif isinstance(part, dict) and part.get('type') == 'text':
                        content += part.get('text', '')
            elif isinstance(msg.get('content'), str):
                content = msg['content']
            elif isinstance(msg.get('content'), list):
                for part in msg['content']:
                    if isinstance(part, str):
                        content += part
                    elif isinstance(part, dict) and part.get('type') == 'text':
                        content += part.get('text', '')

            if content.strip():
                transcript_lines.append(f"## User\n\n{content.strip()}\n")

        elif msg_type == 'assistant' or role == 'assistant':
            content = ''
            if isinstance(msg.get('message'), dict):
                for part in msg['message'].get('content', []):
                    if isinstance(part, str):
                        content += part
                    elif isinstance(part, dict) and part.get('type') == 'text':
                        content += part.get('text', '')
                    elif isinstance(part, dict) and part.get('type') == 'tool_use':
                        tool_name = part.get('name', 'unknown')
                        content += f"\n_[Tool call: {tool_name}]_\n"
            elif isinstance(msg.get('content'), str):
                content = msg['content']
            elif isinstance(msg.get('content'), list):
                for part in msg['content']:
                    if isinstance(part, str):
                        content += part
                    elif isinstance(part, dict) and part.get('type') == 'text':
                        content += part.get('text', '')
                    elif isinstance(part, dict) and part.get('type') == 'tool_use':
                        tool_name = part.get('name', 'unknown')
                        content += f"\n_[Tool call: {tool_name}]_\n"

            if content.strip():
                transcript_lines.append(f"## Claude\n\n{content.strip()}\n")

with open(output_path, 'w') as f:
    f.write(frontmatter)
    f.write('\n'.join(transcript_lines))
    f.write('\n')

print(f"Transcript written: {output_path}")
PYTHON_SCRIPT

# Also archive a timestamped copy to the evidence repo
SESSION_DIR="$EVIDENCE_REPO/sessions/$PROJECT_NAME"
mkdir -p "$SESSION_DIR"
cp "$PROJECT_DIR/session.md" "$SESSION_DIR/$TIMESTAMP.md"

# Commit to evidence repo
cd "$EVIDENCE_REPO"
git add "sessions/$PROJECT_NAME/$TIMESTAMP.md"
git commit -m "Session capture: $PROJECT_NAME $TIMESTAMP [$SESSION_ID]" --quiet 2>/dev/null || true

echo "Session archived: $SESSION_DIR/$TIMESTAMP.md"
