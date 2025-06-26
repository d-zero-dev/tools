import type { RemoteInspectorOptions } from './types.js';

import { describe, expect, test } from 'vitest';

import { validateRemoteInspectorArgs } from './validation.js';

describe('validateRemoteInspectorArgs', () => {
	const baseOptions: RemoteInspectorOptions = {
		host: 'example.com',
		user: 'testuser',
		remoteDir: '/var/www/html',
	};

	test('should pass for valid private key authentication', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
			keyPath: '/path/to/key.pem',
		};

		expect(() => validateRemoteInspectorArgs(options)).not.toThrow();
	});

	test('should pass for valid private key authentication with passphrase', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
			keyPath: '/path/to/key.pem',
			passphrase: 'mypassphrase',
		};

		expect(() => validateRemoteInspectorArgs(options)).not.toThrow();
	});

	test('should pass for valid password authentication', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
			password: 'mypassword',
		};

		expect(() => validateRemoteInspectorArgs(options)).not.toThrow();
	});

	test('should throw error when host is missing', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
			host: undefined,
			keyPath: '/path/to/key.pem',
		};

		expect(() => validateRemoteInspectorArgs(options)).toThrow(
			'--host or RELEASE_HOST is required',
		);
	});

	test('should throw error when user is missing', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
			user: undefined,
			keyPath: '/path/to/key.pem',
		};

		expect(() => validateRemoteInspectorArgs(options)).toThrow(
			'--user or RELEASE_USER is required',
		);
	});

	test('should throw error when both keyPath and password are missing', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
		};

		expect(() => validateRemoteInspectorArgs(options)).toThrow(
			'Either --key/RELEASE_KEY or --password/RELEASE_PASSWORD is required',
		);
	});

	test('should throw error when both keyPath and password are provided', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
			keyPath: '/path/to/key.pem',
			password: 'mypassword',
		};

		expect(() => validateRemoteInspectorArgs(options)).toThrow(
			'Cannot use both --key and --password authentication at the same time',
		);
	});

	test('should throw error when remoteDir is missing', () => {
		const options: RemoteInspectorOptions = {
			...baseOptions,
			remoteDir: undefined,
			keyPath: '/path/to/key.pem',
		};

		expect(() => validateRemoteInspectorArgs(options)).toThrow(
			'--remote-dir or RELEASE_DIR is required',
		);
	});
});
