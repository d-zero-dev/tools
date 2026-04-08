import { describe, expect, test } from 'vitest';

import { urlMatches } from './url-matches.js';

describe('urlMatches', () => {
	describe('基本マッチング', () => {
		test('完全一致のケース', () => {
			expect(urlMatches('https://example.com/', 'https://example.com/')).toBe(true);
			expect(urlMatches('https://example.com/path', 'https://example.com/path')).toBe(
				true,
			);
			expect(
				urlMatches(
					'https://example.com/path/to/page',
					'https://example.com/path/to/page',
				),
			).toBe(true);
		});

		test('異なるURLが正しくfalseを返す', () => {
			expect(urlMatches('https://example.com/', 'https://example.org/')).toBe(false);
			expect(urlMatches('https://example.com/a', 'https://example.com/b')).toBe(false);
			expect(
				urlMatches('https://example.com/path/to/a', 'https://example.com/path/to/b'),
			).toBe(false);
		});
	});

	describe('URLエンコードの正規化', () => {
		test('%20とスペースが等価', () => {
			expect(
				urlMatches('https://example.com/path%20to', 'https://example.com/path to'),
			).toBe(true);
			expect(
				urlMatches(
					'https://example.com/path%20to%20page',
					'https://example.com/path to page',
				),
			).toBe(true);
		});

		test('%2Fは/として扱われない（URLの構造的な文字のため）', () => {
			// %2Fは/として扱われない（URLの構造的な文字のため、decodeURIではデコードされない）
			expect(
				urlMatches('https://example.com/path%2Fto', 'https://example.com/path/to'),
			).toBe(false);
		});

		test('%3Fは?として扱われない（URLの構造的な文字のため）', () => {
			// %3Fは?として扱われない（URLの構造的な文字のため、decodeURIではデコードされない）
			expect(
				urlMatches(
					'https://example.com/path%3Fquery=1',
					'https://example.com/path?query=1',
				),
			).toBe(false);
		});

		test('%23は#として扱われない（URLの構造的な文字のため）', () => {
			// %23は#として扱われない（URLの構造的な文字のため、decodeURIではデコードされない）
			expect(
				urlMatches(
					'https://example.com/path%23section',
					'https://example.com/path#section',
				),
			).toBe(false);
		});

		test('複数のエンコード文字が混在するケース（%20のみデコードされる）', () => {
			// %20はスペースとしてデコードされるが、%2Fは/としてデコードされない
			expect(
				urlMatches(
					'https://example.com/path%20to%2Fpage',
					'https://example.com/path to%2Fpage', // cspell:disable-line
				),
			).toBe(true);
		});

		test('エンコードされていない文字とエンコードされた文字の比較', () => {
			expect(urlMatches('https://example.com/path', 'https://example.com/path')).toBe(
				true,
			);
			expect(
				urlMatches('https://example.com/path%20to', 'https://example.com/path%20to'),
			).toBe(true);
		});
	});

	describe('スラッシュ終わりの正規化', () => {
		test('ルートレベルのスラッシュ終わり', () => {
			expect(urlMatches('https://example.com/', 'https://example.com')).toBe(true);
			expect(urlMatches('https://example.com', 'https://example.com/')).toBe(true);
		});

		test('1階層のスラッシュ終わり', () => {
			expect(urlMatches('https://example.com/path/', 'https://example.com/path')).toBe(
				false,
			);
			expect(urlMatches('https://example.com/path', 'https://example.com/path/')).toBe(
				false,
			);
		});

		test('2階層のスラッシュ終わり', () => {
			expect(urlMatches('https://example.com/a/b/', 'https://example.com/a/b')).toBe(
				false,
			);
			expect(urlMatches('https://example.com/a/b', 'https://example.com/a/b/')).toBe(
				false,
			);
		});

		test('3階層のスラッシュ終わり', () => {
			expect(urlMatches('https://example.com/a/b/c/', 'https://example.com/a/b/c')).toBe(
				false,
			);
			expect(urlMatches('https://example.com/a/b/c', 'https://example.com/a/b/c/')).toBe(
				false,
			);
		});

		test('4階層以上のスラッシュ終わり', () => {
			expect(
				urlMatches('https://example.com/a/b/c/d/', 'https://example.com/a/b/c/d'),
			).toBe(false);
			expect(
				urlMatches('https://example.com/a/b/c/d/e/', 'https://example.com/a/b/c/d/e'),
			).toBe(false);
		});
	});

	describe('indexページのバリエーション', () => {
		describe('ルートレベル', () => {
			test('/と/indexが等価', () => {
				expect(urlMatches('https://example.com/', 'https://example.com/index')).toBe(
					true,
				);
				expect(urlMatches('https://example.com/index', 'https://example.com/')).toBe(
					true,
				);
			});

			test('/と/index.htmlが等価', () => {
				expect(urlMatches('https://example.com/', 'https://example.com/index.html')).toBe(
					true,
				);
				expect(urlMatches('https://example.com/index.html', 'https://example.com/')).toBe(
					true,
				);
			});

			test('/と/index.htmが等価', () => {
				expect(urlMatches('https://example.com/', 'https://example.com/index.htm')).toBe(
					true,
				);
				expect(urlMatches('https://example.com/index.htm', 'https://example.com/')).toBe(
					true,
				);
			});

			test('/indexと/index.htmlが等価', () => {
				expect(
					urlMatches('https://example.com/index', 'https://example.com/index.html'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/index.html', 'https://example.com/index'),
				).toBe(true);
			});
		});

		describe('1階層', () => {
			test('/path/と/path/indexが等価', () => {
				expect(
					urlMatches('https://example.com/path/', 'https://example.com/path/index'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/path/index', 'https://example.com/path/'),
				).toBe(true);
			});

			test('/path/と/path/index.htmlが等価', () => {
				expect(
					urlMatches('https://example.com/path/', 'https://example.com/path/index.html'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/path/index.html', 'https://example.com/path/'),
				).toBe(true);
			});

			test('/path/indexと/path/index.htmlが等価', () => {
				expect(
					urlMatches(
						'https://example.com/path/index',
						'https://example.com/path/index.html',
					),
				).toBe(true);
				expect(
					urlMatches(
						'https://example.com/path/index.html',
						'https://example.com/path/index',
					),
				).toBe(true);
			});
		});

		describe('2階層', () => {
			test('/a/b/と/a/b/indexが等価', () => {
				expect(
					urlMatches('https://example.com/a/b/', 'https://example.com/a/b/index'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/a/b/index', 'https://example.com/a/b/'),
				).toBe(true);
			});

			test('/a/b/と/a/b/index.htmlが等価', () => {
				expect(
					urlMatches('https://example.com/a/b/', 'https://example.com/a/b/index.html'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/a/b/index.html', 'https://example.com/a/b/'),
				).toBe(true);
			});

			test('/a/b/indexと/a/b/index.htmlが等価', () => {
				expect(
					urlMatches(
						'https://example.com/a/b/index',
						'https://example.com/a/b/index.html',
					),
				).toBe(true);
				expect(
					urlMatches(
						'https://example.com/a/b/index.html',
						'https://example.com/a/b/index',
					),
				).toBe(true);
			});
		});

		describe('3階層以上', () => {
			test('/a/b/c/と/a/b/c/indexが等価', () => {
				expect(
					urlMatches('https://example.com/a/b/c/', 'https://example.com/a/b/c/index'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/a/b/c/index', 'https://example.com/a/b/c/'),
				).toBe(true);
			});

			test('/a/b/c/と/a/b/c/index.htmlが等価', () => {
				expect(
					urlMatches(
						'https://example.com/a/b/c/',
						'https://example.com/a/b/c/index.html',
					),
				).toBe(true);
				expect(
					urlMatches(
						'https://example.com/a/b/c/index.html',
						'https://example.com/a/b/c/',
					),
				).toBe(true);
			});

			test('/a/b/c/d/と/a/b/c/d/index.htmlが等価', () => {
				expect(
					urlMatches(
						'https://example.com/a/b/c/d/',
						'https://example.com/a/b/c/d/index.html',
					),
				).toBe(true);
				expect(
					urlMatches(
						'https://example.com/a/b/c/d/index.html',
						'https://example.com/a/b/c/d/',
					),
				).toBe(true);
			});
		});
	});

	describe('拡張子オプション', () => {
		test('デフォルトで.htmlと.htmが考慮される', () => {
			// index は index.html にマッチ（デフォルト拡張子）
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.html'),
			).toBe(true);
			// index は index.htm にマッチ（デフォルト拡張子）
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.htm'),
			).toBe(true);
			// しかし、index.html と index.htm は異なる拡張子なので一致しない
			expect(
				urlMatches('https://example.com/index.html', 'https://example.com/index.htm'),
			).toBe(false);
			expect(
				urlMatches(
					'https://example.com/path/index.html',
					'https://example.com/path/index.htm',
				),
			).toBe(false);
		});

		test('オプションで.phpを渡した場合、/index.phpもマッチ', () => {
			// index は index.php にマッチ（拡張子なしと拡張子あり）
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.php', {
					extensions: ['.php'],
				}),
			).toBe(true);
			// しかし、index.html と index.php は異なる拡張子なので一致しない
			expect(
				urlMatches('https://example.com/index.html', 'https://example.com/index.php', {
					extensions: ['.php'],
				}),
			).toBe(false);
			expect(
				urlMatches(
					'https://example.com/path/index',
					'https://example.com/path/index.php',
					{
						extensions: ['.php'],
					},
				),
			).toBe(true);
		});

		test('オプションで.phpと.jspを渡した場合、indexは両方の拡張子にマッチ', () => {
			// index は index.php にマッチ
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.php', {
					extensions: ['.php', '.jsp'],
				}),
			).toBe(true);
			// index は index.jsp にマッチ
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.jsp', {
					extensions: ['.php', '.jsp'],
				}),
			).toBe(true);
			// しかし、index.php と index.jsp は異なる拡張子なので一致しない
			expect(
				urlMatches('https://example.com/index.php', 'https://example.com/index.jsp', {
					extensions: ['.php', '.jsp'],
				}),
			).toBe(false);
			expect(
				urlMatches(
					'https://example.com/path/index.php',
					'https://example.com/path/index.jsp',
					{
						extensions: ['.php', '.jsp'],
					},
				),
			).toBe(false);
		});

		test('拡張子が異なる場合（.htmlと.phpでオプション指定なし）はfalse', () => {
			expect(
				urlMatches('https://example.com/index.html', 'https://example.com/index.php'),
			).toBe(false);
			expect(
				urlMatches(
					'https://example.com/path/index.html',
					'https://example.com/path/index.php',
				),
			).toBe(false);
		});

		test('オプションで指定した拡張子は上書き（デフォルト拡張子は無視）', () => {
			// extensions: ['.php'] を指定した場合、デフォルト拡張子（.html, .htm）は無視される
			// index は index.html にマッチしない（.php のみが有効）
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.html', {
					extensions: ['.php'],
				}),
			).toBe(false);
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.htm', {
					extensions: ['.php'],
				}),
			).toBe(false);
			// index は index.php にマッチ（オプション拡張子）
			expect(
				urlMatches('https://example.com/index', 'https://example.com/index.php', {
					extensions: ['.php'],
				}),
			).toBe(true);
			// index.html と index.php は異なる拡張子なので一致しない
			expect(
				urlMatches('https://example.com/index.html', 'https://example.com/index.php', {
					extensions: ['.php'],
				}),
			).toBe(false);
			expect(
				urlMatches('https://example.com/index.htm', 'https://example.com/index.php', {
					extensions: ['.php'],
				}),
			).toBe(false);
		});
	});

	describe('特殊URLの正規化（運用上間違ったURL）', () => {
		describe('ダブルスラッシュ', () => {
			test('https://example.com//pathが正規化されてマッチ', () => {
				expect(urlMatches('https://example.com//path', 'https://example.com/path')).toBe(
					true,
				);
				expect(urlMatches('https://example.com/path', 'https://example.com//path')).toBe(
					true,
				);
			});

			test('https://example.com/path//toが正規化されてマッチ', () => {
				expect(
					urlMatches('https://example.com/path//to', 'https://example.com/path/to'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/path/to', 'https://example.com/path//to'),
				).toBe(true);
			});

			test('https://example.com///が正規化されてマッチ', () => {
				expect(urlMatches('https://example.com///', 'https://example.com/')).toBe(true);
				expect(urlMatches('https://example.com/', 'https://example.com///')).toBe(true);
			});
		});

		describe('連続スラッシュ', () => {
			test('3つ以上の連続スラッシュが正規化される', () => {
				expect(urlMatches('https://example.com///', 'https://example.com/')).toBe(true);
				expect(urlMatches('https://example.com////', 'https://example.com/')).toBe(true);
				expect(
					urlMatches('https://example.com/path///to', 'https://example.com/path/to'),
				).toBe(true);
			});

			test('パス中の連続スラッシュが正規化される', () => {
				expect(
					urlMatches('https://example.com/a//b//c', 'https://example.com/a/b/c'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/a/b/c', 'https://example.com/a//b//c'),
				).toBe(true);
			});
		});

		describe('その他の特殊ケース', () => {
			test('末尾のスラッシュと連続スラッシュの組み合わせ', () => {
				expect(
					urlMatches('https://example.com/path//', 'https://example.com/path/'),
				).toBe(true);
				expect(
					urlMatches('https://example.com/path/', 'https://example.com/path//'),
				).toBe(true);
			});

			test('パス中の.や..の処理', () => {
				// parseUrlは.を正規化するので、path/./toとpath/toは等価
				expect(
					urlMatches('https://example.com/path/./to', 'https://example.com/path/to'),
				).toBe(true);
				// parseUrlは..を正規化するので、path/../toは/toになる
				expect(
					urlMatches('https://example.com/path/../to', 'https://example.com/path/to'),
				).toBe(false);
				expect(
					urlMatches('https://example.com/path/../to', 'https://example.com/to'),
				).toBe(true);
			});
		});
	});

	describe('クエリパラメータ', () => {
		test('クエリパラメータの順不同', () => {
			expect(
				urlMatches('https://example.com/?a=1&b=2', 'https://example.com/?b=2&a=1'),
			).toBe(true);
			expect(
				urlMatches(
					'https://example.com/path?a=1&b=2',
					'https://example.com/path?b=2&a=1',
				),
			).toBe(true);
			expect(
				urlMatches(
					'https://example.com/path?a=1&b=2&c=3',
					'https://example.com/path?c=3&a=1&b=2',
				),
			).toBe(true);
		});

		test('クエリパラメータが同じ値の場合は等価', () => {
			expect(urlMatches('https://example.com/?a=1', 'https://example.com/?a=1')).toBe(
				true,
			);
			expect(
				urlMatches(
					'https://example.com/path?a=1&b=2',
					'https://example.com/path?a=1&b=2',
				),
			).toBe(true);
		});

		test('クエリパラメータが異なる場合はfalse', () => {
			expect(urlMatches('https://example.com/?a=1', 'https://example.com/?a=2')).toBe(
				false,
			);
			expect(
				urlMatches('https://example.com/?a=1&b=2', 'https://example.com/?a=1&b=3'),
			).toBe(false);
		});

		test('クエリパラメータがない場合とある場合の比較', () => {
			expect(urlMatches('https://example.com/', 'https://example.com/?a=1')).toBe(false);
			expect(urlMatches('https://example.com/path', 'https://example.com/path?a=1')).toBe(
				false,
			);
		});
	});

	describe('プロトコル・ホスト・ポート', () => {
		test('HTTPとHTTPSは異なる', () => {
			expect(urlMatches('http://example.com/', 'https://example.com/')).toBe(false);
			expect(urlMatches('https://example.com/', 'http://example.com/')).toBe(false);
		});

		test('ホスト名が異なる場合はfalse', () => {
			expect(urlMatches('https://example.com/', 'https://example.org/')).toBe(false);
			expect(urlMatches('https://www.example.com/', 'https://api.example.com/')).toBe(
				false,
			);
		});

		test('ポート番号が異なる場合はfalse', () => {
			expect(urlMatches('https://example.com:80/', 'https://example.com:8080/')).toBe(
				false,
			);
			expect(urlMatches('https://example.com:443/', 'https://example.com:8443/')).toBe(
				false,
			);
		});

		test('ポート番号が同じ場合は等価', () => {
			expect(urlMatches('https://example.com:8080/', 'https://example.com:8080/')).toBe(
				true,
			);
			expect(
				urlMatches('https://example.com:8080/path', 'https://example.com:8080/path'),
			).toBe(true);
		});
	});

	describe('階層のテスト（詳細）', () => {
		describe('1階層', () => {
			test('/aと/a.htmlの比較', () => {
				expect(urlMatches('https://example.com/a', 'https://example.com/a.html')).toBe(
					false,
				);
			});

			test('/a/と/a/index.htmlの比較', () => {
				expect(
					urlMatches('https://example.com/a/', 'https://example.com/a/index.html'),
				).toBe(true);
			});
		});

		describe('2階層', () => {
			test('/a/bと/a/b.htmlの比較', () => {
				expect(
					urlMatches('https://example.com/a/b', 'https://example.com/a/b.html'),
				).toBe(false);
			});

			test('/a/b/と/a/b/index.htmlの比較', () => {
				expect(
					urlMatches('https://example.com/a/b/', 'https://example.com/a/b/index.html'),
				).toBe(true);
			});

			test('/a/bと/a/b/indexの比較', () => {
				expect(
					urlMatches('https://example.com/a/b', 'https://example.com/a/b/index'),
				).toBe(false);
			});
		});

		describe('3階層', () => {
			test('/a/b/cと/a/b/c.htmlの比較', () => {
				expect(
					urlMatches('https://example.com/a/b/c', 'https://example.com/a/b/c.html'),
				).toBe(false);
			});

			test('/a/b/c/と/a/b/c/index.htmlの比較', () => {
				expect(
					urlMatches(
						'https://example.com/a/b/c/',
						'https://example.com/a/b/c/index.html',
					),
				).toBe(true);
			});

			test('/a/b/cと/a/b/c/indexの比較', () => {
				expect(
					urlMatches('https://example.com/a/b/c', 'https://example.com/a/b/c/index'),
				).toBe(false);
			});

			test('/a/b/c/indexと/a/b/c/index.htmlの比較', () => {
				expect(
					urlMatches(
						'https://example.com/a/b/c/index',
						'https://example.com/a/b/c/index.html',
					),
				).toBe(true);
			});
		});

		describe('4階層以上', () => {
			test('/a/b/c/dと/a/b/c/d.htmlの比較', () => {
				expect(
					urlMatches('https://example.com/a/b/c/d', 'https://example.com/a/b/c/d.html'),
				).toBe(false);
			});

			test('/a/b/c/d/と/a/b/c/d/index.htmlの比較', () => {
				expect(
					urlMatches(
						'https://example.com/a/b/c/d/',
						'https://example.com/a/b/c/d/index.html',
					),
				).toBe(true);
			});
		});
	});

	describe('ハッシュの扱い', () => {
		test('ハッシュは比較対象外', () => {
			expect(urlMatches('https://example.com/#section', 'https://example.com/')).toBe(
				true,
			);
			expect(urlMatches('https://example.com/', 'https://example.com/#section')).toBe(
				true,
			);
			expect(urlMatches('https://example.com/path#top', 'https://example.com/path')).toBe(
				true,
			);
		});

		test('ハッシュが異なってもパスが同じなら等価', () => {
			expect(
				urlMatches(
					'https://example.com/path#section1',
					'https://example.com/path#section2',
				),
			).toBe(true);
			expect(
				urlMatches('https://example.com/path#top', 'https://example.com/path#bottom'),
			).toBe(true);
		});
	});

	describe('認証情報の扱い', () => {
		test('認証情報は比較対象外', () => {
			expect(urlMatches('https://user:pass@example.com/', 'https://example.com/')).toBe(
				true,
			);
			expect(urlMatches('https://example.com/', 'https://user:pass@example.com/')).toBe(
				true,
			);
			expect(
				urlMatches(
					'https://user1:pass1@example.com/path',
					'https://user2:pass2@example.com/path',
				),
			).toBe(true);
		});
	});

	describe('エッジケース', () => {
		test('無効なURLの処理', () => {
			// parseUrlは無効なURLでもエラーを投げずにExURLオブジェクトを返す
			// そのため、無効なURL同士の比較は可能
			expect(urlMatches('not-a-url', 'not-a-url')).toBe(true);
		});

		test('特殊文字を含むURL', () => {
			expect(
				urlMatches('https://example.com/path+to', 'https://example.com/path+to'),
			).toBe(true);
			expect(
				urlMatches('https://example.com/path@to', 'https://example.com/path@to'),
			).toBe(true);
		});
	});
});
