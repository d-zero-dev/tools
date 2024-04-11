import type { Animations } from './types.js';

export function riffle(text: string, elapsed: number, animations: Animations) {
	for (const key of Object.keys(animations)) {
		const animation = animations[key];
		if (!animation) {
			continue;
		}
		const [fps, ...sprites] = animation;
		const frameDuration = 1000 / fps;

		const currentFrame = Math.floor(elapsed / frameDuration) % sprites.length;

		const replacement = sprites[currentFrame];
		if (!replacement) {
			continue;
		}
		text = text.replaceAll(`%${key}%`, replacement);
	}

	return text;
}
