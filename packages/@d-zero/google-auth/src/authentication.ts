import type { OAuth2Client } from 'google-auth-library';

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import c from 'ansi-colors';
import { google } from 'googleapis';

import { log } from './debug.js';

const FINISHED_MESSAGE = `🔑 ${c.bold.green('Authentication successful')}\n`;

export async function authentication(
	credentialFilePath: string,
	scope: readonly string[],
	tokenFilePath?: string,
) {
	const credentials = await getCredentials(credentialFilePath);

	const dir = path.dirname(credentialFilePath);
	const name = path.basename(credentialFilePath, path.extname(credentialFilePath));
	tokenFilePath = tokenFilePath ?? path.join(dir, `${name}.token`);

	log('Authorize to Google on OAuth2');
	const { client_secret, client_id, redirect_uris } = credentials.installed;
	const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
	log('Load token file: %s', tokenFilePath);
	const token = await fs
		.readFile(tokenFilePath, { encoding: 'utf8' })
		.catch((error) => new Error(error));

	if (token instanceof Error) {
		log('Failed to load token file');
		const newOAuth2Client = await getNewToken(oAuth2Client, scope, tokenFilePath);
		process.stdout.write(FINISHED_MESSAGE);
		return newOAuth2Client;
	}

	const tokenObj = JSON.parse(token);
	log('Set credential token: %O', tokenObj);
	oAuth2Client.setCredentials(tokenObj);

	const tokenInfo = await oAuth2Client
		.getTokenInfo(oAuth2Client.credentials.access_token!)
		.catch((error) => {
			log('Token is invalid or expired:', error);
			return null;
		});

	if (tokenInfo) {
		log('Token is valid for the following scopes:', tokenInfo.scopes);
		process.stdout.write(FINISHED_MESSAGE);
		return oAuth2Client;
	}

	await fs.rm(tokenFilePath);

	const newOAuth2Client = await getNewToken(oAuth2Client, scope, tokenFilePath);
	process.stdout.write(FINISHED_MESSAGE);
	return newOAuth2Client;
}

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

	return new Promise<OAuth2Client>((resolve, reject) => {
		rl.question(
			c.blueBright(`Enter the ${c.bold('URL')} from the redirected page here: `),
			(redirectUrl) => {
				const url = new URL(redirectUrl);
				const code = url.searchParams.get('code');
				if (!code) {
					throw new Error(`Bad URL: ${redirectUrl}`);
				}
				rl.close();
				oAuth2Client.getToken(code, async (err, token) => {
					if (err || !token) {
						return reject(
							new Error(
								'Error while trying to retrieve access token, ' + (err?.message || ''),
							),
						);
					}
					oAuth2Client.setCredentials(token);
					await fs.writeFile(tokenFilePath, JSON.stringify(token));
					resolve(oAuth2Client);
				});
			},
		);
	});
}
