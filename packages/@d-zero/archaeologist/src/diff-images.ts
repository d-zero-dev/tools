import type { Screenshot } from '@d-zero/puppeteer-screenshot';

import { Jimp, HorizontalAlign, VerticalAlign, JimpMime } from 'jimp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export type DiffImagesPhase = {
	create: { a: Uint8Array; b: Uint8Array };
	resize: { a: Uint8Array; b: Uint8Array; width: number; height: number };
	diff: { a: Uint8Array; b: Uint8Array };
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
	const imgA = PNG.sync.read(Buffer.from(dataA.binary));
	const imgB = PNG.sync.read(Buffer.from(dataB.binary));

	const width = Math.max(imgA.width, imgB.width);
	const height = Math.max(imgA.height, imgB.height);

	listener('resize', { a: dataA.binary, b: dataB.binary, width, height });
	const resizedA = await resizeImg(Buffer.from(dataA.binary), width, height);
	const resizedB = await resizeImg(Buffer.from(dataB.binary), width, height);

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
	img.contain({
		w: width,
		h: height,
		align: HorizontalAlign.LEFT | VerticalAlign.TOP,
	});

	return img.getBuffer(JimpMime.png);
}
