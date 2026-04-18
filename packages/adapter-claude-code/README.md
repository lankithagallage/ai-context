# @ai-context/adapter-claude-code

Hook that pipes Claude Code session transcripts into `ai-context capture` on
context compression / session end.

## Install

```bash
pnpm add -D @ai-context/adapter-claude-code
```

## Wire up

Add the hook to your Claude Code settings (`~/.claude/settings.json` or
`.claude/settings.json` in the repo):

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @ai-context/adapter-claude-code"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @ai-context/adapter-claude-code"
          }
        ]
      }
    ]
  }
}
```

Claude Code passes the hook payload on stdin. The hook reads
`transcript_path`, then runs:

```
npx -y @ai-context/cli capture --file <transcript> --tool claude-code
```

Failures are swallowed so a capture hiccup never blocks your coding session.
