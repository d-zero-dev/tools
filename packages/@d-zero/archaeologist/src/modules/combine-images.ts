import { Jimp, JimpMime } from 'jimp';

/**
 * 2枚の画像を左右に並べて合成する
 * @param imageA 環境Aの画像バッファ
 * @param imageB 環境Bの画像バッファ
 * @returns 合成された画像のバッファ
 */
export async function combineImages(imageA: Buffer, imageB: Buffer): Promise<Buffer> {
	const imgA = await Jimp.read(imageA);
	const imgB = await Jimp.read(imageB);

	const padding = 20;

	const widthA = imgA.width;
	const heightA = imgA.height;
	const widthB = imgB.width;
	const heightB = imgB.height;

	const combinedWidth = padding + widthA + padding + widthB + padding;
	const combinedHeight = padding + Math.max(heightA, heightB) + padding;

	const combined = new Jimp({
		width: combinedWidth,
		height: combinedHeight,
		color: 0xff_ff_ff_ff,
	});

	combined.composite(imgA, padding, padding);
	combined.composite(imgB, padding + widthA + padding, padding);

	return combined.getBuffer(JimpMime.png);
}
