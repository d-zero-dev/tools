import type { OAuth2Client } from 'google-auth-library';

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import c from 'ansi-colors';
import { google } from 'googleapis';

import { log } from './debug.js';

const FINISHED_MESSAGE = `🔑 ${c.bold.green('Authentication successful')}\n`;

export type AuthenticationOptions = {
	readonly tokenFilePath?: string;
	readonly checkTokenExpiry?: boolean;
};

/**
 *
 * @param credentialFilePath
 * @param scope
 * @param options
 */
export async function authentication(
	credentialFilePath: string,
	scope: readonly string[],
	options?: AuthenticationOptions,
) {
	const credentials = await getCredentials(credentialFilePath);

	const dir = path.dirname(credentialFilePath);
	const name = path.basename(credentialFilePath);
	const tokenFilePath = options?.tokenFilePath ?? path.join(dir, `${name}.token`);
	const checkTokenExpiry = options?.checkTokenExpiry ?? false;

	log('Authorize to Google on OAuth2');
	const { client_secret, client_id, redirect_uris } = credentials.installed;
	const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
	log('Load token file: %s', tokenFilePath);
	const token = await fs
		.readFile(tokenFilePath, { encoding: 'utf8' })
		.catch((error) => new Error(error));

	if (token instanceof Error) {
		log('You need to authorize to Google on OAuth2 because the token file is missing');
		const newOAuth2Client = await getNewToken(oAuth2Client, scope, tokenFilePath);
		process.stdout.write(FINISHED_MESSAGE);
		return newOAuth2Client;
	}

	const tokenObj = JSON.parse(token);
	log('Set credential token: %O', tokenObj);
	oAuth2Client.setCredentials(tokenObj);

	if (!checkTokenExpiry) {
		log('Skip token expiry check');
		process.stdout.write(FINISHED_MESSAGE);
		return oAuth2Client;
	}

	const tokenInfo = await oAuth2Client
		.getTokenInfo(oAuth2Client.credentials.access_token!)
		.catch((error) => {
			log('Token is invalid or expired:', error);
			return null;
		});

	if (tokenInfo) {
		log('Token is valid for the following scopes:', tokenInfo.scopes);
		log('Expires at: %s', new Date(tokenInfo.expiry_date).toLocaleString('ja-JP'));
		process.stdout.write(FINISHED_MESSAGE);
		return oAuth2Client;
	}

	log('Token is invalid or expired: %O', tokenInfo);

	await fs.rm(tokenFilePath);

	const newOAuth2Client = await getNewToken(oAuth2Client, scope, tokenFilePath);
	process.stdout.write(FINISHED_MESSAGE);
	return newOAuth2Client;
}

/**
 *
 * @param credentialFilePath
 */
async function getCredentials(credentialFilePath: string) {
	const credentialsAbsPath = path.isAbsolute(credentialFilePath)
		? credentialFilePath
		: path.resolve(process.cwd(), credentialFilePath);

	log('Load credential JSON: %s', credentialsAbsPath);
	const credentialJSON = await fs.readFile(credentialsAbsPath, 'utf8');
	const credentials = JSON.parse(credentialJSON);
	log('Loaded credentials: %O', credentials);
	return credentials;
}

/**
 *
 * @param oAuth2Client
 * @param scope
 * @param tokenFilePath
 */
async function getNewToken(
	oAuth2Client: OAuth2Client,
	scope: readonly string[],
	tokenFilePath: string,
) {
	log('Getting new token interactively');
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: [...scope],
	});

	const scopeServices = scope.map((scopeUrl) => {
		if (scopeUrl.startsWith('https://www.googleapis.com/auth/spreadsheets')) {
			return 'Google Sheets';
		}
		if (scopeUrl.startsWith('https://www.googleapis.com/auth/drive')) {
			return 'Google Drive';
		}
		return 'Unknown Service';
	});

	process.stdout.write(
		`🔑 ${c.bgGreen(`${c.bold(' Authorization')} (${scopeServices.join(',')}) `)}\n\n`,
	);
	process.stdout.write(`🔰 ${c.greenBright('Access this URL')}: ${authUrl}\n\n`);

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const redirectUrl = await new Promise<string>((resolve) => {
		rl.question(
			c.blueBright(`Enter the ${c.bold('URL')} from the redirected page here: `),
			resolve,
		);
	});
	rl.close();

	const url = new URL(redirectUrl);
	const code = url.searchParams.get('code');
	if (!code) {
		throw new Error(`Bad URL: ${redirectUrl}`);
	}

	process.stdout.write(c.greenBright(`🔑 ${c.gray('Got code: ')}${code}\n`));

	const { tokens } = await oAuth2Client.getToken(code);
	oAuth2Client.setCredentials(tokens);
	await fs.writeFile(tokenFilePath, JSON.stringify(tokens));
	return oAuth2Client;
}
