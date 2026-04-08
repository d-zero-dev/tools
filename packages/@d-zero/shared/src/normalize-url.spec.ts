import { describe, expect, test } from 'vitest';

import { normalizeUrl } from './normalize-url.js';

describe('normalizeUrl', () => {
	describe('URLエンコードの正規化', () => {
		test('%20はエンコードされた形式で保持される', () => {
			expect(normalizeUrl('https://example.com/path%20to')).toBe(
				'https://example.com/path%20to',
			);
		});

		test('%2Fは/として扱われない（URLの構造的な文字のため）', () => {
			expect(normalizeUrl('https://example.com/path%2Fto')).toBe(
				'https://example.com/path%2Fto',
			);
		});
	});

	describe('スラッシュ終わりの正規化', () => {
		test('ルートレベルのスラッシュ終わり', () => {
			expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
		});

		test('1階層のスラッシュ終わり', () => {
			// /path/ は /path/ のまま保持（/path/index と等価にするため）
			expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path/');
			// /path は /path のまま保持（/path/ とは異なる）
			expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path');
		});

		test('2階層のスラッシュ終わり', () => {
			// /a/b/ は /a/b/ のまま保持（/a/b/index と等価にするため）
			expect(normalizeUrl('https://example.com/a/b/')).toBe('https://example.com/a/b/');
			// /a/b は /a/b のまま保持（/a/b/ とは異なる）
			expect(normalizeUrl('https://example.com/a/b')).toBe('https://example.com/a/b');
		});

		test('3階層のスラッシュ終わり', () => {
			// /a/b/c/ は /a/b/c/ のまま保持（/a/b/c/index と等価にするため）
			expect(normalizeUrl('https://example.com/a/b/c/')).toBe(
				'https://example.com/a/b/c/',
			);
			// /a/b/c は /a/b/c のまま保持（/a/b/c/ とは異なる）
			expect(normalizeUrl('https://example.com/a/b/c')).toBe('https://example.com/a/b/c');
		});
	});

	describe('indexページの正規化', () => {
		describe('ルートレベル', () => {
			test('/indexが/に正規化される', () => {
				expect(
					normalizeUrl('https://example.com/index', {
						ignorableExtensions: ['.html', '.htm'],
					}),
				).toBe('https://example.com/');
			});

			test('/index.htmlが/に正規化される', () => {
				expect(
					normalizeUrl('https://example.com/index.html', {
						ignorableExtensions: ['.html', '.htm'],
					}),
				).toBe('https://example.com/');
			});

			test('/index.htmが/に正規化される', () => {
				expect(
					normalizeUrl('https://example.com/index.htm', {
						ignorableExtensions: ['.html', '.htm'],
					}),
				).toBe('https://example.com/');
			});
		});

		describe('1階層', () => {
			test('/path/indexが/path/に正規化される', () => {
				expect(
					normalizeUrl('https://example.com/path/index', {
						ignorableExtensions: ['.html', '.htm'],
					}),
				).toBe('https://example.com/path/');
			});

			test('/path/index.htmlが/path/に正規化される', () => {
				expect(
					normalizeUrl('https://example.com/path/index.html', {
						ignorableExtensions: ['.html', '.htm'],
					}),
				).toBe('https://example.com/path/');
			});

			test('/path/が/path/のまま保持される（/path/indexと等価にするため）', () => {
				expect(normalizeUrl('https://example.com/path/')).toBe(
					'https://example.com/path/',
				);
			});

			test('/pathが/pathのまま保持される', () => {
				expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path');
			});
		});

		describe('2階層', () => {
			test('/a/b/indexが/a/b/に正規化される', () => {
				expect(
					normalizeUrl('https://example.com/a/b/index', {
						ignorableExtensions: ['.html', '.htm'],
					}),
				).toBe('https://example.com/a/b/');
			});

			test('/a/b/index.htmlが/a/b/に正規化される', () => {
				expect(
					normalizeUrl('https://example.com/a/b/index.html', {
						ignorableExtensions: ['.html', '.htm'],
					}),
				).toBe('https://example.com/a/b/');
			});

			test('/a/b/が/a/b/のまま保持される（/a/b/indexと等価にするため）', () => {
				expect(normalizeUrl('https://example.com/a/b/')).toBe('https://example.com/a/b/');
			});

			test('/a/bが/a/bのまま保持される', () => {
				expect(normalizeUrl('https://example.com/a/b')).toBe('https://example.com/a/b');
			});
		});
	});

	describe('拡張子の処理', () => {
		test('非indexページの拡張子は保持される', () => {
			expect(normalizeUrl('https://example.com/path.html')).toBe(
				'https://example.com/path.html',
			);
		});

		test('indexページの指定された拡張子は削除される', () => {
			expect(
				normalizeUrl('https://example.com/index.html', {
					ignorableExtensions: ['.html', '.htm'],
				}),
			).toBe('https://example.com/');
			expect(
				normalizeUrl('https://example.com/index.htm', {
					ignorableExtensions: ['.html', '.htm'],
				}),
			).toBe('https://example.com/');
		});

		test('indexページのオプション拡張子は削除される', () => {
			expect(
				normalizeUrl('https://example.com/index.php', {
					ignorableExtensions: ['.php'],
				}),
			).toBe('https://example.com/');
		});

		test('indexページの無視不可能な拡張子は保持される', () => {
			expect(normalizeUrl('https://example.com/index.js')).toBe(
				'https://example.com/index.js',
			);
		});
	});

	describe('クエリパラメータ', () => {
		test('クエリパラメータは保持される', () => {
			expect(normalizeUrl('https://example.com/path?a=1&b=2')).toBe(
				'https://example.com/path?a=1&b=2',
			);
		});

		test('クエリパラメータの順序は正規化される（parseUrlがソート）', () => {
			expect(normalizeUrl('https://example.com/path?b=2&a=1')).toBe(
				'https://example.com/path?a=1&b=2',
			);
		});
	});

	describe('プロトコル・ホスト・ポート', () => {
		test('プロトコルは小文字に正規化される', () => {
			expect(normalizeUrl('HTTPS://example.com/')).toBe('https://example.com/');
		});

		test('ホスト名は小文字に正規化される', () => {
			expect(normalizeUrl('https://EXAMPLE.COM/')).toBe('https://example.com/');
		});

		test('ポート番号は保持される', () => {
			expect(normalizeUrl('https://example.com:8080/')).toBe('https://example.com:8080/');
		});
	});

	describe('ハッシュの扱い', () => {
		test('ハッシュは削除される', () => {
			expect(normalizeUrl('https://example.com/#section')).toBe('https://example.com/');
			expect(normalizeUrl('https://example.com/path#top')).toBe(
				'https://example.com/path',
			);
		});
	});

	describe('認証情報の扱い', () => {
		test('認証情報は保持される（normalizeUrlでは保持、urlMatchesで無視）', () => {
			expect(normalizeUrl('https://user:pass@example.com/')).toBe(
				'https://user:pass@example.com/',
			);
		});
	});
});
