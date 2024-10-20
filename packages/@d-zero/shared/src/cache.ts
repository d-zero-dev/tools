import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { hash } from './hash.js';

/**
 * A class representing a simple cache system that stores data in the file system.
 *
 * @template T - The type of data to be cached.
 */
export class Cache<T> {
	/**
	 * The temporary directory where cache files are stored.
	 */
	protected readonly tmpDir: string;

	/**
	 * Creates an instance of Cache.
	 *
	 * @param name - The name of the cache, used to create a subdirectory in the temporary directory.
	 * @param tmpDir - Optional. The base temporary directory. Defaults to the system's temporary directory.
	 */
	constructor(name: string, tmpDir?: string) {
		tmpDir = tmpDir ?? os.tmpdir();
		tmpDir = path.isAbsolute(tmpDir) ? tmpDir : path.join(process.cwd(), tmpDir);
		this.tmpDir = path.join(tmpDir, ...name.split('/'));
	}

	/**
	 * Clears the cache by removing all files in the cache directory.
	 *
	 * @returns A promise that resolves when the cache has been cleared.
	 */
	async clear() {
		await fs.rm(this.tmpDir, { recursive: true, force: true });
	}

	/**
	 * Loads a cached value by its key.
	 *
	 * @param key - The key of the cached value.
	 * @param reviver - Optional. A function that transforms the results. This function is called for each member of the object.
	 * @returns A promise that resolves to the cached value, or null if the value is not found.
	 */
	async load(key: string, reviver?: Parameters<typeof JSON.parse>[1]): Promise<T | null> {
		const name = hash(key) + '.json';
		const filePath = path.join(this.tmpDir, name);
		const data = await fs.readFile(filePath, 'utf8').catch(() => null);
		return data ? JSON.parse(data, reviver) : null;
	}

	/**
	 * Stores a value in the cache.
	 *
	 * @param key - The key under which the value should be stored.
	 * @param value - The value to be cached.
	 * @returns A promise that resolves to the filename of the cached value.
	 */
	async store(key: string, value: T): Promise<string> {
		const name = hash(key) + '.json';
		const filePath = path.join(this.tmpDir, name);
		await fs.mkdir(this.tmpDir, { recursive: true });
		const data = JSON.stringify(value);
		await fs.writeFile(filePath, data, 'utf8');
		return name;
	}
}

/**
 * A class that extends the `Cache` class to handle binary data using `Buffer`.
 * This class provides methods to load and store binary data in a temporary directory.
 *
 * @extends {Cache<Uint8Array>}
 */
export class BinaryCache extends Cache<Uint8Array> {
	/**
	 * Checks if a cached file exists for the given key.
	 *
	 * @param {string} key - The key to check in the cache.
	 * @returns A promise that resolves to `true` if the file exists, otherwise `false`.
	 */
	async exists(key: string): Promise<boolean> {
		const name = hash(key);
		const filePath = path.join(this.tmpDir, name);
		const data = await fs.stat(filePath).catch(() => null);
		return !!data;
	}

	/**
	 * Loads binary data from the cache using the provided key.
	 * The key is hashed and used to generate the filename.
	 *
	 * @param {string} key - The key to identify the cached data.
	 * @returns {Promise<Uint8Array | null>} - A promise that resolves to the binary data or null if not found.
	 */
	override async load(key: string): Promise<Uint8Array | null> {
		const ext = path.extname(key);
		const name = hash(key) + ext;
		const filePath = path.join(this.tmpDir, name);
		const data = await fs.readFile(filePath).catch(() => null);
		return data;
	}

	/**
	 * Stores binary data in the cache using the provided key.
	 * The key is hashed and used to generate the filename.
	 *
	 * @param {string} key - The key to identify the cached data.
	 * @param {Uint8Array} value - The binary data to be stored.
	 * @returns {Promise<string>} - A promise that resolves to the filename of the cached data.
	 */
	override async store(key: string, value: Uint8Array): Promise<string> {
		const ext = path.extname(key);
		const name = hash(key) + ext;
		const filePath = path.join(this.tmpDir, name);
		await fs.mkdir(this.tmpDir, { recursive: true });
		await fs.writeFile(filePath, value);
		return name;
	}
}
