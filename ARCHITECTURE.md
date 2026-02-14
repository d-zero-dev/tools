# Architecture Documentation

This document provides comprehensive information about the @d-zero-dev/tools monorepo architecture, intended for contributors and maintainers.

## Table of Contents

- [Repository Overview](#repository-overview)
- [Monorepo Structure](#monorepo-structure)
- [Package Categories](#package-categories)
- [Development Environment](#development-environment)
- [Build System](#build-system)
- [Testing Framework](#testing-framework)
- [Code Quality](#code-quality)
- [Package Management](#package-management)
- [Contribution Workflow](#contribution-workflow)
- [Architectural Patterns](#architectural-patterns)
- [Key Design Decisions](#key-design-decisions)

## Repository Overview

This is a monorepo containing tools and libraries for web development, testing, and automation, managed by Lerna with Yarn workspaces. All packages are published under the `@d-zero` scope on npm.

### Technology Stack

- **Language**: TypeScript (ESM modules)
- **Package Manager**: Yarn 4 (Berry) with Volta
- **Monorepo Tool**: Lerna (independent versioning)
- **Testing**: Vitest
- **Linting**: ESLint, Prettier, textlint, cspell
- **Commit Convention**: Commitizen with conventional commits
- **CI/CD**: Husky for git hooks

### Key Characteristics

- **Independent versioning**: Each package has its own version number
- **ESM-only**: All packages use ES modules (`"type": "module"`)
- **TypeScript**: Full TypeScript support with strict typing
- **Modular exports**: Packages like `@d-zero/shared` use granular export paths

## Monorepo Structure

```
@d-zero-dev/tools/
├── packages/
│   └── @d-zero/
│       ├── a11y-check/              # Accessibility checking CLI
│       ├── a11y-check-core/         # Core accessibility checking library
│       ├── a11y-check-axe-scenario/ # axe-core scenario
│       ├── a11y-check-scenarios/    # Custom scenarios
│       ├── archaeologist/           # Diff checker CLI
│       ├── backlog-projects/        # Backlog project management CLI
│       ├── beholder/                # Web scraping library
│       ├── cli-core/                # Common CLI utilities
│       ├── dealer/                  # Parallel processing manager
│       ├── filematch/               # File matching CLI
│       ├── fs/                      # File system utilities (zip/unzip)
│       ├── google-auth/             # Google API authentication
│       ├── google-sheets/           # Google Sheets API wrapper
│       ├── html-distiller/          # HTML parsing and extraction
│       ├── notion/                  # Notion API integration
│       ├── print/                   # Screenshot CLI
│       ├── proc-talk/               # Process communication
│       ├── puppeteer-dealer/        # Puppeteer page handling
│       ├── puppeteer-general-actions/ # Puppeteer utilities
│       ├── puppeteer-page-scan/     # Page scanning helpers
│       ├── puppeteer-screenshot/    # Screenshot functionality
│       ├── puppeteer-scroll/        # Page scrolling
│       ├── readtext/                # Text reading utilities
│       ├── remote-inspector/        # SSH/SFTP file comparison CLI
│       ├── replicator/              # Web page replication CLI
│       ├── roar/                    # CLI helper (meow-based)
│       └── shared/                  # Shared utilities
├── lerna.json                       # Lerna configuration
├── package.json                     # Root package configuration
├── tsconfig.json                    # TypeScript base config
├── CLAUDE.md                        # AI assistant guidelines
├── ARCHITECTURE.md                  # This file
└── README.md                        # User-facing documentation (Japanese)
```

## Package Categories

### CLI Tools

CLI tools provide command-line interfaces for various tasks:

- **@d-zero/a11y-check**: Accessibility checking with Puppeteer and Google Sheets integration
- **@d-zero/archaeologist**: Production vs development environment diff checker
- **@d-zero/backlog-projects**: Backlog project management
- **@d-zero/filematch**: File matching utility
- **@d-zero/print**: Web page screenshot tool (PNG/PDF/Note formats)
- **@d-zero/remote-inspector**: SSH/SFTP-based remote file comparison
- **@d-zero/replicator**: Responsive web page replication

**Common patterns:**

- Use `@d-zero/cli-core` or `@d-zero/roar` for CLI argument parsing
- Accept URL lists from files (with frontmatter support)
- Support page hooks for authentication
- Export both CLI and library APIs

### Accessibility

Packages for web accessibility testing:

- **@d-zero/a11y-check-core**: Core checking functionality
- **@d-zero/a11y-check-axe-scenario**: axe-core integration
- **@d-zero/a11y-check-scenarios**: Custom checking scenarios

### Puppeteer Utilities

Packages for browser automation:

- **@d-zero/puppeteer-dealer**: Multi-page handling and browser management
- **@d-zero/puppeteer-general-actions**: General Puppeteer actions
- **@d-zero/puppeteer-page-scan**: Page scanning with device presets
- **@d-zero/puppeteer-screenshot**: Screenshot capture
- **@d-zero/puppeteer-scroll**: Page scrolling utilities

**Dependency:** All depend on `puppeteer` (peer dependency in most cases)

### Google Integration

Packages for Google API integration:

- **@d-zero/google-auth**: OAuth2 authentication for Google APIs
- **@d-zero/google-sheets**: Type-safe Google Sheets API wrapper

**Authentication flow:**

1. OAuth 2.0 Desktop client credentials
2. Local token storage
3. Interactive authentication on first use

### Utilities

Core utility packages:

- **@d-zero/beholder**: Web scraping and recording
- **@d-zero/cli-core**: Shared CLI utilities (minimist-based)
- **@d-zero/dealer**: Parallel task execution with concurrency control
- **@d-zero/fs**: File system operations (archiver/unzipper)
- **@d-zero/html-distiller**: HTML parsing and extraction
- **@d-zero/notion**: Notion API client
- **@d-zero/proc-talk**: Process communication
- **@d-zero/readtext**: Text file reading with encoding detection
- **@d-zero/roar**: CLI helper built on meow
- **@d-zero/shared**: Common utility functions (see below)

### Shared Package

`@d-zero/shared` is the foundation package providing modular utilities via individual export paths:

**Design principle:** Each utility is exported separately (e.g., `@d-zero/shared/delay`) to enable tree-shaking and reduce bundle size.

**Categories:**

- **Core**: cache, config-reader, deferred, hash, types
- **Random & Delay**: delay, random-int, sample-distribution, parse-interval
- **Date**: between-weekend-days, skip-holiday-period, skip-holidays
- **URL/Path**: decode-uri-safely, encode-resource-path, normalize-url, parse-url, path-list-to-tree, path-to-url, remove-auth, url-matches, url-to-file-name, url-to-local-path, validate-same-host
- **Array/String**: split-array, remove-matches, str-to-regex
- **Sort**: alphabetical, dir, numerical, path
- **Other**: filesize, mime-to-extension, race-with-timeout, ratio-value, retry, timestamp, typed-await-event-emitter

**Note:** See [CLAUDE.md](./CLAUDE.md) for the export strategy rule: never modify the export strategy without explicit permission.

## Development Environment

### Prerequisites

- **Node.js**: Managed by Volta (version specified in `package.json`)
- **Yarn**: Managed by Volta (version specified in `package.json`)

### Setup

```bash
# Clone the repository
git clone https://github.com/d-zero-dev/tools.git
cd tools

# Install dependencies (Volta will automatically use the correct Node.js and Yarn versions)
yarn

# Build all packages
yarn build

# Run tests
yarn test

# Lint and format
yarn lint
```

### Volta

Volta automatically manages Node.js and Yarn versions based on `package.json`:

```json
{
	"volta": {
		"node": "24.13.1",
		"yarn": "4.12.0"
	}
}
```

No manual version switching needed - Volta handles it automatically.

## Build System

### TypeScript Compilation

Each package has its own TypeScript configuration extending from `@d-zero/tsconfig`:

```json
{
	"extends": "@d-zero/tsconfig",
	"compilerOptions": {
		"outDir": "./dist",
		"rootDir": "./src"
	}
}
```

**Build commands:**

- `yarn build`: Build all packages via Lerna
- `yarn watch`: Watch mode for all packages
- `yarn clean`: Clean build artifacts

**Build output:**

- All packages output to `dist/` directory
- TypeScript declaration files (`.d.ts`) are generated
- Source maps are included for debugging

### Package Scripts

Standard scripts in each package:

```json
{
	"scripts": {
		"build": "tsc",
		"watch": "tsc --watch",
		"clean": "tsc --build --clean"
	}
}
```

### Lerna

Lerna manages the monorepo:

```json
{
	"version": "independent",
	"npmClient": "yarn",
	"packages": ["packages/@d-zero/*"],
	"command": {
		"version": {
			"message": "chore(release): publish"
		}
	}
}
```

**Key features:**

- **Independent versioning**: Each package has its own semantic version
- **Conventional commits**: Automatic version bumping and changelog generation
- **Cross-package dependencies**: Automatically handled

## Testing Framework

### Vitest

All tests use Vitest (fast, ESM-native test runner):

```bash
# Run all tests
yarn test

# Run tests in watch mode
vitest

# Run tests for a specific package
cd packages/@d-zero/shared
vitest
```

### Test File Conventions

From [CLAUDE.md](./CLAUDE.md):

1. **Naming**: `*.spec.ts` extension
2. **Location**: Adjacent to source files (e.g., `foo.ts` → `foo.spec.ts`)
3. **Structure**: Follow AAA pattern (Arrange, Act, Assert)
4. **Principles**:
   - No conditionals (if/else/switch) in test code
   - No calculations or logic processing (except file paths)
   - No try/catch blocks in test code
   - Test one behavior per test case
5. **Pure function testing**: Test without mocks when possible
6. **Color output testing**: Verify ANSI escape sequences
7. **Mock usage**: Use mocks for external dependencies, side effects, and uncontrollable inputs

### Example Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './my-function.js';

describe('myFunction', () => {
	it('should return expected value', () => {
		// Arrange
		const input = 'test';
		const expected = 'test-result';

		// Act
		const result = myFunction(input);

		// Assert
		expect(result).toBe(expected);
	});
});
```

## Code Quality

### ESLint

Configuration from `@d-zero/eslint-config`:

```bash
# Lint and auto-fix
yarn lint:eslint
```

**Rules from [CLAUDE.md](./CLAUDE.md):**

- Always run lint before commit
- Resolve ALL lint errors/warnings
- Ask user permission before disabling ESLint rules
- Prefer code fixes over disabling rules
- Justify disable usage when necessary

### Prettier

Code formatting via `@d-zero/prettier-config`:

```bash
# Format all files
yarn lint:prettier
```

**Formatted files:**

- TypeScript: `.ts`, `.cts`, `.mts`, `.tsx`
- JavaScript: `.js`, `.cjs`, `.mjs`, `.jsx`
- Markdown: `.md`
- JSON: `.json`

### textlint

Markdown linting via `@d-zero/textlint-config`:

```bash
# Auto-fix markdown issues
yarn lint:textlint:fix

# Check markdown
yarn lint:textlint:check
```

### cspell

Spell checking:

```bash
# Check spelling
yarn lint:cspell
```

### Pre-commit Hooks

Husky runs quality checks before commit:

1. lint-staged (configured via `@d-zero/lint-staged-config`)
2. commitlint (configured via `@d-zero/commitlint-config`)

## Package Management

### Dependency Management

**Rules from [CLAUDE.md](./CLAUDE.md):**

- Use `yarn` (not `npm`) for all package management
- Check latest versions: `npm view <package-name> version`
- View version history: `npm view <package-name> versions --json`
- Check outdated: `npm outdated`
- Avoid web searches for version checking

### Publishing

```bash
# Publish stable release
yarn release

# Publish prerelease (next tag)
yarn release:next

# Update dependencies interactively
yarn update
```

**Publishing workflow:**

1. Run `yarn build` and `yarn test` (prerelease script)
2. Lerna analyzes conventional commits
3. Bump versions based on commit types
4. Generate CHANGELOGs
5. Create git tags
6. Publish to npm with public access

### Versioning Strategy

**Independent versioning:** Each package maintains its own version number.

**Commit convention:**

- `feat:` → Minor version bump
- `fix:` → Patch version bump
- `BREAKING CHANGE:` → Major version bump

**Example commit:**

```
feat(print): add --open-disclosures option

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Package Exports

**Standard pattern:**

```json
{
	"type": "module",
	"main": "dist/index.js",
	"types": "dist/index.d.ts",
	"exports": {
		".": {
			"types": "./dist/index.d.ts",
			"import": "./dist/index.js"
		}
	},
	"files": ["dist"]
}
```

**@d-zero/shared pattern (modular exports):**

```json
{
	"exports": {
		"./delay": {
			"import": "./dist/delay.js",
			"types": "./dist/delay.d.ts"
		},
		"./cache": {
			"import": "./dist/cache.js",
			"types": "./dist/cache.d.ts"
		}
	}
}
```

## Contribution Workflow

### Before Starting

1. Read [CLAUDE.md](./CLAUDE.md) for development guidelines
2. Ensure development environment is set up
3. Run `yarn` to install dependencies
4. Run `yarn build` to verify builds work

### Making Changes

1. **Always read files first** before editing
2. Work from repository root (not package directories)
3. Use `yarn build` to build all packages
4. Use `yarn test` to run all tests
5. Run `yarn lint` before commit

### Commit Guidelines

From [CLAUDE.md](./CLAUDE.md):

1. Use Commitizen: `yarn co` or `yarn commit`
2. Follow conventional commit format
3. Separate commit scope (don't mix implementation with docs/rules)
4. Complete all related changes in a feature

**Git safety:**

- Never update git config
- Never run destructive commands without explicit request
- Never skip hooks
- Never force push to main/dev

### Pull Request Process

1. Create feature branch from `dev`
2. Make changes with descriptive commits
3. Run `yarn lint`, `yarn build`, `yarn test`
4. Push to remote
5. Create PR with detailed description
6. Address review feedback

### Branch Strategy

- **dev**: Main development branch (default for PRs)
- **main**: Production branch (if different from dev)
- Feature branches: Short-lived, merged to dev

## Architectural Patterns

### CLI Architecture

**Pattern 1: cli-core-based (minimist)**

```typescript
import { parseArgs } from '@d-zero/cli-core';

const args = parseArgs(process.argv.slice(2), {
	string: ['listfile', 'type'],
	boolean: ['debug', 'verbose'],
	alias: {
		f: 'listfile',
		t: 'type',
	},
});
```

**Pattern 2: roar-based (meow)**

```typescript
import { roar } from '@d-zero/roar';

const cli = roar({
	flags: {
		listfile: {
			type: 'string',
			alias: 'f',
		},
	},
});
```

**Common features:**

- File-based URL lists with frontmatter support
- Page hooks for authentication
- Parallel execution with `@d-zero/dealer`
- Debug and verbose modes

### Page Hooks

Many CLI tools support page hooks via frontmatter:

```markdown
---
hooks:
  - ./login.mjs
  - ./wait-for-content.cjs
---

https://example.com/page1
https://example.com/page2
```

**Hook signature:**

```typescript
export type PageHook = (
	page: Page,
	context: {
		name: string;
		width: number;
		resolution: number;
		log: (message: string) => void;
	},
) => Promise<void>;
```

### Config Reader Pattern

Using `@d-zero/shared/config-reader` for frontmatter:

```typescript
import { readConfigFile } from '@d-zero/shared/config-reader';

const { config, content } = await readConfigFile<{
	hooks?: string[];
	cache?: boolean;
}>('urls.txt');

// config.hooks: ['./hook1.mjs', './hook2.mjs']
// content: 'https://example.com\nhttps://example.com/page'
```

### Parallel Processing Pattern

Using `@d-zero/dealer`:

```typescript
import { deal } from '@d-zero/dealer';

await deal(
	urls,
	(url, update, index, setLineHeader, push) => {
		return async () => {
			update('Processing...');
			const result = await fetchAndProcess(url);
			// Dynamically enqueue new items during processing
			const newUrls = extractLinks(result);
			await push(...newUrls);
		};
	},
	{
		limit: 10,
		interval: 1000,
	},
);
```

### Error Handling

From [CLAUDE.md](./CLAUDE.md):

**Principles:**

- Never suppress errors (no empty catch blocks)
- Handle specific error types appropriately
- Preserve error context when re-throwing
- Log before throwing for debugging
- Fail fast - let unhandled errors bubble up
- Prefer `.catch()` for single await expressions
- Don't catch just to rethrow
- Avoid massive try blocks

**Good pattern:**

```typescript
await operation().catch((error) => {
	log.error('Operation failed:', error.message);
	throw error; // Preserve original error
});
```

**Bad pattern:**

```typescript
try {
	// Massive try block with many operations
	await operation1();
	await operation2();
	// ... many more operations
} catch (error) {
	// Generic error handling
	console.error('Something failed');
}
```

## Key Design Decisions

### ESM-Only

**Decision:** All packages use ES modules exclusively.

**Rationale:**

- Modern JavaScript standard
- Better tree-shaking
- Native browser support
- Future-proof

**Implications:**

- `"type": "module"` in all package.json
- `.js` extensions in imports
- No CommonJS interop needed

### Modular Exports (@d-zero/shared)

**Decision:** Export each utility separately instead of barrel exports.

**Rationale:**

- Enables tree-shaking
- Reduces bundle size
- Clear dependencies
- Prevents circular dependencies

**Example:**

```typescript
// Good: Specific import
import { delay } from '@d-zero/shared/delay';

// Bad: Barrel import (not available)
import { delay } from '@d-zero/shared';
```

**CRITICAL:** Never modify this export strategy without explicit permission (see [CLAUDE.md](./CLAUDE.md)).

### Independent Versioning

**Decision:** Each package has its own version number.

**Rationale:**

- Packages evolve at different rates
- Clear change tracking per package
- Reduces unnecessary version bumps
- Semantic versioning per package

**Tradeoff:** More complex dependency management, but handled by Lerna.

### TypeScript Strict Mode

**Decision:** Use strict TypeScript configuration.

**Rationale:**

- Catch errors at compile time
- Better IDE support
- Self-documenting code
- Prevents common mistakes

**Configuration:**

```json
{
	"compilerOptions": {
		"strict": true,
		"noImplicitAny": true,
		"strictNullChecks": true
	}
}
```

### CLI + Library Pattern

**Decision:** CLI tools export both CLI and library APIs.

**Rationale:**

- Reusable functionality
- Programmatic access
- Testing without CLI invocation
- Composition of tools

**Example:**

```typescript
// Library API
export async function print(url: string, options: PrintOptions): Promise<void>;

// CLI entry point
// cli.ts
import { print } from './print.js';
```

### Frontmatter Configuration

**Decision:** Use frontmatter in list files for configuration.

**Rationale:**

- Keep data and config together
- Familiar format (YAML)
- Extensible
- Version controllable

**Example:**

```markdown
---
hooks:
  - ./hook.mjs
cache: true
---

https://example.com
https://example.com/page
```

### Volta for Version Management

**Decision:** Use Volta instead of nvm or other version managers.

**Rationale:**

- Automatic version switching
- Per-project versions
- No manual intervention
- Cross-platform support

**Configuration:** Single source of truth in root `package.json`.

### Puppeteer as Peer Dependency

**Decision:** Most Puppeteer packages use peer dependencies.

**Rationale:**

- Avoid multiple Puppeteer installations
- User controls Puppeteer version
- Smaller package sizes
- Prevent version conflicts

**Exception:** `@d-zero/print` includes Puppeteer directly for CLI convenience.

## Additional Resources

- [CLAUDE.md](./CLAUDE.md) - Development guidelines for AI assistants
- [README.md](./README.md) - User-facing documentation (Japanese)
- [Lerna Documentation](https://lerna.js.org/)
- [Vitest Documentation](https://vitest.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Questions or Issues?

- Check existing package READMEs for specific documentation
- Review [CLAUDE.md](./CLAUDE.md) for development patterns
- Open an issue on GitHub for clarification
- Consult the source code - implementation is the source of truth
