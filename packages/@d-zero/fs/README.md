# `@d-zero/fs`

`@d-zero/fs` provides file system utilities for working with zip archives.

## Features

- **zip(outputFilePath: string, targetDir: string): Promise<void>**
  Compresses the contents of a target directory into a zip archive saved at the specified output file path.

- **unzip(zipFilePath: string, targetDir: string): Promise<void>**
  Extracts the contents of a zip archive into the specified directory.

- **extractZip(zipFilePath: string): Promise<unzipper.Open.File>**
  Opens a zip file and returns an object representing the archive using the `unzipper` library.

## Installation

```bash
npm install @d-zero/fs
```

## Usage

Since the package uses ES modules, import the functions from the subpath `"@d-zero/fs/zip"`.

```js
import { zip } from '@d-zero/fs/zip';

await zip('path/to/archive.zip', 'path/to/targetDir');
```

```js
import { unzip } from '@d-zero/fs/zip';

await unzip('path/to/archive.zip', 'path/to/extractDir');
```

```js
import { extractZip } from '@d-zero/fs/zip';

const directory = await extractZip('path/to/archive.zip');
console.log(directory.files); // List of files in the archive
```
