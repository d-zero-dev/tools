# @d-zero/replicator

Replicate web pages with all their resources to local directories with responsive image support

## Installation

```bash
npm install @d-zero/replicator
```

## Usage

### CLI

```bash
npx @d-zero/replicator <url> -o <output-directory> [options]
```

#### Options

- `-o, --output <dir>`: Output directory (required)
- `-t, --timeout <ms>`: Request timeout in milliseconds (default: 30000)
- `-d, --devices <devices>`: Device presets (comma-separated, default: desktop-compact,mobile)
- `-v, --verbose`: Enable verbose logging

#### Available Device Presets

- `desktop`: 1400px width
- `tablet`: 768px width
- `mobile`: 375px width (2x resolution)
- `desktop-hd`: 1920px width
- `desktop-compact`: 1280px width
- `mobile-large`: 414px width (3x resolution)
- `mobile-small`: 320px width (2x resolution)

#### Examples

```bash
# Default devices (desktop-compact, mobile)
npx @d-zero/replicator https://example.com -o ./output

# Custom devices
npx @d-zero/replicator https://example.com -o ./output --devices desktop,tablet,mobile

# With timeout
npx @d-zero/replicator https://example.com -o ./output --timeout 60000
```

### Programmatic

```typescript
import { replicate } from '@d-zero/replicator';

// Default devices
await replicate('https://example.com', './output');

// Custom devices
await replicate('https://example.com', './output', {
	devices: {
		desktop: { width: 1400 },
		mobile: { width: 375, resolution: 2 },
	},
	timeout: 30000,
	verbose: true,
});
```

## Features

- **Responsive Image Support**: Captures resources from `<picture>` elements and media queries across multiple device widths
- **Lazy Loading Support**: Automatically scrolls pages to trigger `loading=lazy` and `IntersectionObserver` based content
- **Multi-Device Simulation**: Simulates various device widths and resolutions to ensure comprehensive resource capture
- Download HTML pages preserving directory structure
- Fetch all related resources (CSS, JS, images, etc.)
- Maintain relative links between resources
- Support for same-host resources only
- Preserve original file extensions and paths

## License

MIT
