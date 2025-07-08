# @d-zero/replicator

Replicate web pages with all their resources to local directories

## Installation

```bash
npm install @d-zero/replicator
```

## Usage

### CLI

```bash
npx @d-zero/replicator <url> -o <output-directory>
```

### Programmatic

```typescript
import { replicate } from '@d-zero/replicator';

await replicate('https://example.com', './output');
```

## Features

- Download HTML pages preserving directory structure
- Fetch all related resources (CSS, JS, images, etc.)
- Maintain relative links between resources
- Support for same-host resources only
- Preserve original file extensions and paths

## License

MIT
