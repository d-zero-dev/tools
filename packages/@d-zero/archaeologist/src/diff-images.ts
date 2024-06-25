import type { Screenshot } from '@d-zero/puppeteer-screenshot';

import Jimp from 'jimp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export type DiffImagesPhase = {
	create: { a: Buffer; b: Buffer };
	resize: { a: Buffer; b: Buffer; width: number; height: number };
	diff: { a: Buffer; b: Buffer };
};

type DiffImagesListener = (
	phase: keyof DiffImagesPhase,
	data: DiffImagesPhase[keyof DiffImagesPhase],
) => void;

export async function diffImages(
	dataA: Screenshot,
	dataB: Screenshot,
	listener: DiffImagesListener,
) {
	if (!dataA.binary || !dataB.binary) {
		return null;
	}

	listener('create', { a: dataA.binary, b: dataB.binary });
	const imgA = PNG.sync.read(dataA.binary);
	const imgB = PNG.sync.read(dataB.binary);

	const width = Math.max(imgA.width, imgB.width);
	const height = Math.max(imgA.height, imgB.height);

	listener('resize', { a: dataA.binary, b: dataB.binary, width, height });
	const resizedA = await resizeImg(dataA.binary, width, height);
	const resizedB = await resizeImg(dataB.binary, width, height);

	listener('diff', { a: resizedA, b: resizedB });
	const imgA_ = PNG.sync.read(resizedA);
	const imgB_ = PNG.sync.read(resizedB);

	const diffImage = new PNG({ width, height });

	const matcheBytes = pixelmatch(imgA_.data, imgB_.data, diffImage.data, width, height);
	const matches = 1 - matcheBytes / (width * height);

	const imageABuffer = PNG.sync.write(imgA_);
	const imageBBuffer = PNG.sync.write(imgB_);
	const imageDiffBuffer = PNG.sync.write(diffImage);

	return {
		matches,
		images: {
			a: imageABuffer,
			b: imageBBuffer,
			diff: imageDiffBuffer,
		},
	};
}

async function resizeImg(bin: Buffer, width: number, height: number) {
	const img = await Jimp.read(bin);
	img.contain(width, height, Jimp.HORIZONTAL_ALIGN_LEFT | Jimp.VERTICAL_ALIGN_TOP);

	return new Promise<Buffer>((resolve, reject) => {
		img.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
			if (err) reject(err);
			resolve(buffer);
		});
	});
}
