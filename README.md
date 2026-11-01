# CyberCmd

Build and understand security commands. Pick options, get a valid command, and see what every part does.
Starts with Nmap. **Generate and explain only: the app never runs anything.**

**Live demo:** https://cybercmd.arun-prasad.workers.dev

Every flag carries a "verified in lab" status that is only set after I ran it myself and wrote down what I saw.

## Stack

Vite + React + TypeScript. Data in YAML, validated with zod. Tests with Vitest. Static site.

## Hosting

A static site: `npm run build` puts it in `dist/`, which any static host can serve. `cloudflare.config.ts` deploys
it to Cloudflare Workers static assets with the `cf` CLI.

## Data

```
data/tools/<tool>/_tool.yaml     tool info and group list
data/tools/<tool>/<group>.yaml   flags in that group
data/presets/<tool>.yaml         example commands
```

The zod schemas in `src/schema/` define the shape. `npm run validate` checks every file (types, unique ids,
real groups, real `conflicts`/`requires` targets, preset arguments) and names the file, line and field on error.
CI runs it on every push.

Editing YAML in VS Code with the Red Hat YAML extension gives autocomplete from `schemas/*.schema.json`.
After changing a zod schema, run `npm run schema` and commit the result.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run validate` | Check the data files |
| `npm test` | Unit tests |
| `npm run check` | Lint, typecheck, validate, test |
| `npm run build` | Production build into `dist/` |

## Ground rules

Test only against your own lab, TryHackMe, or scanme.nmap.org at a low rate.

## License

MIT
