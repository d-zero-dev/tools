import type { OnProgress } from './types.js';
import type { ReadStream } from 'node:fs';

/**
 * Compares two ReadStreams and checks if their contents are equal.
 *
 * @param stream1 The first ReadStream to compare.
 * @param stream2 The second ReadStream to compare.
 * @param onProgress An optional callback function that will be called with the total number of bytes read from the streams.
 * @returns A Promise that resolves to `true` if the streams have the same contents, or `false` otherwise.
 */
export async function compareStreams(
	stream1: ReadStream,
	stream2: ReadStream,
	onProgress?: OnProgress,
) {
	let bufferredSize = 0;

	let buffer1 = Buffer.alloc(0);
	let buffer2 = Buffer.alloc(0);

	return new Promise<boolean>((resolve, reject) => {
		function tryCompareAndExitIfDifferent() {
			const compareLength = Math.min(buffer1.length, buffer2.length);
			if (compareLength > 0) {
				const chunk1 = buffer1.slice(0, compareLength);
				const chunk2 = buffer2.slice(0, compareLength);
				bufferredSize += compareLength;
				if (onProgress) {
					onProgress(bufferredSize);
				}
				if (!chunk1.equals(chunk2)) {
					stream1.destroy();
					stream2.destroy();
					resolve(false);
					return;
				}
				buffer1 = buffer1.slice(compareLength);
				buffer2 = buffer2.slice(compareLength);
			}
		}

		function readFromStreams() {
			let chunk;
			while (null !== (chunk = stream1.read())) {
				buffer1 = Buffer.concat([buffer1, chunk]);
			}
			while (null !== (chunk = stream2.read())) {
				buffer2 = Buffer.concat([buffer2, chunk]);
			}
			tryCompareAndExitIfDifferent();
		}

		stream1.on('readable', readFromStreams);
		stream2.on('readable', readFromStreams);

		let endCount = 0;
		function handleEnd() {
			endCount++;
			if (endCount !== 2) {
				return;
			}

			tryCompareAndExitIfDifferent();

			stream1.destroy();
			stream2.destroy();

			if (buffer1.length === buffer2.length && buffer1.equals(buffer2)) {
				resolve(true);
				return;
			}

			resolve(false);
		}

		stream1.on('end', handleEnd);
		stream2.on('end', handleEnd);
		stream1.on('error', reject);
		stream2.on('error', reject);
	});
}
