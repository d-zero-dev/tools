import crypto from 'node:crypto';

/**
 * Generates a SHA-256 hash of the given input string.
 *
 * @param origin - The input string to be hashed.
 * @returns The SHA-256 hash of the input string in hexadecimal format.
 */
export function hash(origin: string) {
	return crypto.createHash('sha256').update(origin).digest('hex');
}
