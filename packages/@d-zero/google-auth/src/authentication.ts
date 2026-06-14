import type { OAuth2Client } from 'google-auth-library';

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import c from 'ansi-colors';
import { GoogleAuth, JWT } from 'google-auth-library';
import { google } from 'googleapis';

import { log } from './debug.js';

const FINISHED_MESSAGE = `🔑 ${c.bold.green('Authentication successful')}\n`;

/**
 * OAuth2 Desktop フロー時のブラウザ認証タイムアウト。
 * 5 分は人間が手元のブラウザで「URL を開く → ログイン → 同意」をこなすのに
 * 余裕がある一方、CI などで誤って起動した場合にハングし続けないギリギリの上限。
 */
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

export type AuthenticationOptions = {
	/** トークンファイルの保存先パス（デフォルト: クレデンシャルファイルと同じディレクトリに `.token` 拡張子で保存）。 */
	readonly tokenFilePath?: string;
	/**
	 * `true` のときキャッシュ済みトークンの `expiry_date` を起動時に検査し、
	 * 期限切れなら自動で再認証する。デフォルト `false` の理由は、
	 * Google OAuth クライアントが API 呼び出し時に自動でリフレッシュトークンから
	 * 再取得するため、明示チェックは「起動時に固まる前に気付きたい運用」でだけ必要だから。
	 */
	readonly checkTokenExpiry?: boolean;
};

/**
 * Google API 用 `OAuth2Client` を解決する。
 *
 * 認証方式は以下の優先順位で試す（最初に成立したものを使う）:
 * 1. 引数の `credentialFilePath`（明示指定が常に最優先）
 * 2. 環境変数 `GOOGLE_AUTH_CREDENTIALS`
 * 3. ADC（Application Default Credentials） — `gcloud auth application-default login`、
 *    `GOOGLE_APPLICATION_CREDENTIALS`、GCE メタデータなど
 *
 * 1 → 2 の順なのは「ローカル開発で `.env` の値を一時的にオーバーライドしたい」用途のため。
 * ADC を最後にすることで、CI/CD でクレデンシャル未指定でもサーバ側 metadata 経由で
 * 自然にフォールバックできる。すべて失敗時はセットアップガイダンス付きエラーを投げる。
 * @param credentialFilePath - クレデンシャル JSON のパス。`null`/`undefined` で環境変数 → ADC にフォールバック
 * @param scope - OAuth スコープ配列
 * @param options - OAuth2 Desktop フロー時のみ有効なオプション
 */
export async function authentication(
	credentialFilePath: string | undefined | null,
	scope: readonly string[],
	options?: AuthenticationOptions,
): Promise<OAuth2Client> {
	const resolvedPath = resolveCredentialFilePath(credentialFilePath);

	if (resolvedPath) {
		return authenticateWithFile(resolvedPath, scope, options);
	}

	log('No credential file found, trying ADC');
	return tryADC(scope);
}

/**
 * Authenticate using a credential file (OAuth2 Desktop, Service Account, or Authorized User).
 * @param resolvedPath
 * @param scope
 * @param options
 */
async function authenticateWithFile(
	resolvedPath: string,
	scope: readonly string[],
	options?: AuthenticationOptions,
): Promise<OAuth2Client> {
	const credentials = await getCredentials(resolvedPath);

	// Service Account
	if (credentials.type === 'service_account') {
		log('Detected service account credentials');
		const client = new JWT({
			email: credentials.client_email,
			key: credentials.private_key,
			scopes: [...scope],
		});
		await client.authorize();
		process.stdout.write(FINISHED_MESSAGE);
		return client;
	}

	// Authorized User (e.g., gcloud auth application-default login output)
	if (credentials.type === 'authorized_user') {
		log('Detected authorized_user credentials');
		const auth = new GoogleAuth({
			credentials,
			scopes: [...scope],
		});
		const client = (await auth.getClient()) as OAuth2Client;
		process.stdout.write(FINISHED_MESSAGE);
		return client;
	}

	// OAuth2 Desktop (existing flow)
	if (credentials.installed) {
		log('Detected OAuth2 Desktop credentials');
		return authenticateOAuth2Desktop(resolvedPath, credentials, scope, options);
	}

	throw new Error(
		`Unsupported credential file format: ${resolvedPath}\n` +
			'Expected one of: OAuth2 Desktop (installed), Service Account, or Authorized User credentials.',
	);
}

/**
 * Authenticate using OAuth2 Desktop flow (existing behavior).
 * @param resolvedPath
 * @param credentials
 * @param credentials.installed
 * @param credentials.installed.client_secret
 * @param credentials.installed.client_id
 * @param credentials.installed.redirect_uris
 * @param scope
 * @param options
 */
async function authenticateOAuth2Desktop(
	resolvedPath: string,
	credentials: {
		installed: { client_secret: string; client_id: string; redirect_uris: string[] };
	},
	scope: readonly string[],
	options?: AuthenticationOptions,
): Promise<OAuth2Client> {
	const dir = path.dirname(resolvedPath);
	const name = path.basename(resolvedPath);
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
 * Try Application Default Credentials (ADC).
 * @param scope
 */
async function tryADC(scope: readonly string[]): Promise<OAuth2Client> {
	log('Attempting ADC (Application Default Credentials)');
	const auth = new GoogleAuth({ scopes: [...scope] });
	const client = await auth.getClient().catch((error: unknown) => {
		log('ADC failed: %O', error);
		throw new Error(buildSetupGuideMessage());
	});
	log('ADC authentication succeeded');
	process.stdout.write(FINISHED_MESSAGE);
	return client as OAuth2Client;
}

/**
 *
 */
function buildSetupGuideMessage(): string {
	return [
		'No authentication method available. Set up one of the following:',
		'',
		'  1. gcloud CLI (推奨):',
		'     gcloud auth application-default login --scopes=...',
		'',
		'  2. OAuth2 Desktop credentials:',
		'     クレデンシャルファイルのパスを指定、または GOOGLE_AUTH_CREDENTIALS 環境変数を設定',
		'',
		'  3. サービスアカウント:',
		'     サービスアカウントキーJSONのパスを指定、または GOOGLE_APPLICATION_CREDENTIALS 環境変数を設定',
	].join('\n');
}

/**
 * Resolve credential file path from argument or environment variable.
 * Returns null if no path is available (to allow ADC fallback).
 * @param credentialFilePath
 */
function resolveCredentialFilePath(
	credentialFilePath: string | undefined | null,
): string | null {
	if (credentialFilePath) {
		return credentialFilePath;
	}
	const envPath = process.env.GOOGLE_AUTH_CREDENTIALS;
	if (envPath) {
		return envPath;
	}
	return null;
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
	log('Getting new token via local server redirect');

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

	const { code, redirectUri } = await waitForAuthCode(oAuth2Client, scope);

	process.stdout.write(c.greenBright(`🔑 ${c.gray('Got code: ')}${code}\n`));

	const { tokens } = await oAuth2Client.getToken({ code, redirect_uri: redirectUri });
	oAuth2Client.setCredentials(tokens);
	await fs.writeFile(tokenFilePath, JSON.stringify(tokens));
	return oAuth2Client;
}

/**
 *
 * @param oAuth2Client
 * @param scope
 */
function waitForAuthCode(
	oAuth2Client: OAuth2Client,
	scope: readonly string[],
): Promise<{ code: string; redirectUri: string }> {
	return new Promise((resolve, reject) => {
		let redirectUri = '';

		const server = http.createServer((req, res) => {
			const reqUrl = new URL(req.url ?? '/', redirectUri);
			const code = reqUrl.searchParams.get('code');
			const error = reqUrl.searchParams.get('error');

			if (error) {
				res.writeHead(200, {
					'Content-Type': 'text/html; charset=utf-8',
					Connection: 'close',
				});
				res.end(authResultHtml(false, error));
				clearTimeout(timeoutId);
				server.close();
				reject(new Error(`Authentication error: ${error}`));
				return;
			}

			if (code) {
				res.writeHead(200, {
					'Content-Type': 'text/html; charset=utf-8',
					Connection: 'close',
				});
				res.end(authResultHtml(true));
				clearTimeout(timeoutId);
				server.close();
				resolve({ code, redirectUri });
				return;
			}

			res.writeHead(404, { Connection: 'close' });
			res.end();
		});

		const timeoutId = setTimeout(() => {
			server.close();
			reject(new Error('Authentication timed out (5 minutes)'));
		}, AUTH_TIMEOUT_MS);
		timeoutId.unref();

		server.listen(0, () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				clearTimeout(timeoutId);
				server.close();
				reject(new Error('Failed to start local server'));
				return;
			}

			redirectUri = `http://localhost:${address.port}`;

			const authUrl = oAuth2Client.generateAuthUrl({
				access_type: 'offline',
				scope: [...scope],
				redirect_uri: redirectUri,
			});

			process.stdout.write(
				`🔰 ${c.greenBright('Opening browser for authentication...')}\n`,
			);
			process.stdout.write(
				`   ${c.gray('If the browser does not open automatically, visit:')}\n`,
			);
			process.stdout.write(`   ${authUrl}\n\n`);

			openBrowser(authUrl);
		});
	});
}

/**
 *
 * @param url
 */
function openBrowser(url: string) {
	const command =
		process.platform === 'darwin'
			? 'open'
			: process.platform === 'win32'
				? 'cmd'
				: 'xdg-open';

	const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

	const child = spawn(command, args, { stdio: 'ignore', detached: true });
	child.unref();
	child.on('error', (error) => {
		log('Failed to open browser automatically: %s', error.message);
	});
}

/**
 *
 * @param str
 */
function escapeHtml(str: string) {
	return str
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/**
 *
 * @param success
 * @param error
 */
function authResultHtml(success: boolean, error?: string) {
	const title = success ? '認証成功' : '認証エラー';
	const bg = success ? '#f0fdf4' : '#fef2f2';
	const color = success ? '#166534' : '#991b1b';
	const icon = success ? '✅' : '❌';
	const message = success
		? '認証に成功しました'
		: `認証エラー: <code>${escapeHtml(error ?? 'Unknown')}</code>`;
	const sub = success
		? 'このタブを閉じてターミナルに戻ってください。'
		: 'ターミナルに戻って再度お試しください。';

	return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:${bg};color:${color}}
.c{text-align:center}
h1{font-size:1.5rem}
p{color:#6b7280}
code{background:#fee2e2;padding:2px 6px;border-radius:4px}
</style>
</head>
<body>
<div class="c">
<h1>${icon} ${message}</h1>
<p>${sub}</p>
</div>
</body>
</html>`;
}
