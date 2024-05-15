import { test, expect } from 'vitest';

import { pathComparator } from './path.js';

test('Alphabet natural sort', () => {
	expect(
		['https://hostname.domain/a', 'https://hostname.domain/b'].sort(pathComparator),
	).toStrictEqual(['https://hostname.domain/a', 'https://hostname.domain/b']);
});

test('protocol', () => {
	expect(
		[
			'https://hostname.domain/2',
			'http://hostname.domain/2',
			'https://hostname.domain/1',
			'https://hostname.domain/3',
			'http://hostname.domain/3',
			'http://hostname.domain/1',
		].sort(pathComparator),
	).toStrictEqual([
		'http://hostname.domain/1',
		'https://hostname.domain/1',
		'http://hostname.domain/2',
		'https://hostname.domain/2',
		'http://hostname.domain/3',
		'https://hostname.domain/3',
	]);
});

test('Numeric natural sort', () => {
	expect(
		[
			'https://hostname.domain/10',
			'https://hostname.domain/2',
			'https://hostname.domain/1',
			'https://hostname.domain/100',
			'https://hostname.domain/4',
			'https://hostname.domain/22',
		].sort(pathComparator),
	).toStrictEqual([
		'https://hostname.domain/1',
		'https://hostname.domain/2',
		'https://hostname.domain/4',
		'https://hostname.domain/10',
		'https://hostname.domain/22',
		'https://hostname.domain/100',
	]);
});

test('Numeric natural sort', () => {
	expect(
		[
			'https://hostname.domain/page:10',
			'https://hostname.domain/page:2',
			'https://hostname.domain/page:1',
			'https://hostname.domain/page:100',
			'https://hostname.domain/page:4',
			'https://hostname.domain/page:22',
		].sort(pathComparator),
	).toStrictEqual([
		'https://hostname.domain/page:1',
		'https://hostname.domain/page:2',
		'https://hostname.domain/page:4',
		'https://hostname.domain/page:10',
		'https://hostname.domain/page:22',
		'https://hostname.domain/page:100',
	]);
});

test('Numeric natural sort', () => {
	expect(
		[
			'https://hostname.domain/category_10/detail',
			'https://hostname.domain/category_02/detail',
			'https://hostname.domain/category_01/detail',
			'https://hostname.domain/category_100/detail',
			'https://hostname.domain/category_04/detail',
			'https://hostname.domain/category_22/detail',
		].sort(pathComparator),
	).toStrictEqual([
		'https://hostname.domain/category_01/detail',
		'https://hostname.domain/category_02/detail',
		'https://hostname.domain/category_04/detail',
		'https://hostname.domain/category_10/detail',
		'https://hostname.domain/category_22/detail',
		'https://hostname.domain/category_100/detail',
	]);
});

test('Numeric natural sort', () => {
	expect(
		[
			'https://hostname.domain/?page=10',
			'https://hostname.domain/?page=2',
			'https://hostname.domain/?page=1',
			'https://hostname.domain/?page=100',
			'https://hostname.domain/?page=4',
			'https://hostname.domain/?page=22',
		].sort(pathComparator),
	).toStrictEqual([
		'https://hostname.domain/?page=1',
		'https://hostname.domain/?page=2',
		'https://hostname.domain/?page=4',
		'https://hostname.domain/?page=10',
		'https://hostname.domain/?page=22',
		'https://hostname.domain/?page=100',
	]);
});

test('Numeric natural sort', () => {
	expect(
		[
			'https://hostname.domain/page10.html',
			'https://hostname.domain/page2.html',
			'https://hostname.domain/page1.html',
			'https://hostname.domain/page100.html',
			'https://hostname.domain/page4.html',
			'https://hostname.domain/page22.html',
		].sort(pathComparator),
	).toStrictEqual([
		'https://hostname.domain/page1.html',
		'https://hostname.domain/page2.html',
		'https://hostname.domain/page4.html',
		'https://hostname.domain/page10.html',
		'https://hostname.domain/page22.html',
		'https://hostname.domain/page100.html',
	]);
});

test('Index is first', () => {
	const r = [
		'https://hostname.domain/',
		'https://hostname.domain',
		'https://hostname.domain/index/',
		'https://hostname.domain/index',
		'https://hostname.domain/f',
		'https://hostname.domain/index2',
		'https://hostname.domain/aaa',
		'https://hostname.domain/z',
		'https://hostname.domain/index.php',
		'https://hostname.domain/b',
		'https://hostname.domain/e',
		'https://hostname.domain/index.html',
		'https://hostname.domain/bbbb/index',
		'https://hostname.domain/d',
		'https://hostname.domain/bbbb/',
		'https://hostname.domain/c',
	].sort(pathComparator);
	expect(r).toStrictEqual([
		'https://hostname.domain',
		'https://hostname.domain/',
		'https://hostname.domain/index',
		'https://hostname.domain/index.html',
		'https://hostname.domain/index.php',
		'https://hostname.domain/index2',
		'https://hostname.domain/aaa',
		'https://hostname.domain/b',
		'https://hostname.domain/bbbb/',
		'https://hostname.domain/bbbb/index',
		'https://hostname.domain/c',
		'https://hostname.domain/d',
		'https://hostname.domain/e',
		'https://hostname.domain/f',
		'https://hostname.domain/index/',
		'https://hostname.domain/z',
	]);
});

test('Index is first', () => {
	const r = [
		'http://user:pass@hostname.domain/',
		'http://user:pass@hostname.domain/company',
		'http://user:pass@hostname.domain/news',
		'http://user:pass@hostname.domain/policy',
		'http://user:pass@hostname.domain/privacy',
		'http://user:pass@hostname.domain/security',
		'http://user:pass@hostname.domain/services',
		'http://user:pass@hostname.domain/works',
		'http://user:pass@hostname.domain/contact/',
		'http://user:pass@hostname.domain/news/20181117',
		'http://user:pass@hostname.domain/news/20190410',
		'http://user:pass@hostname.domain/news/20191220',
		'http://user:pass@hostname.domain/projects/xxxxxxx',
		'http://user:pass@hostname.domain/services/',
		'http://user:pass@hostname.domain/services/application',
		'http://user:pass@hostname.domain/services/branding',
		'http://user:pass@hostname.domain/services/communication',
		'http://user:pass@hostname.domain/services/interface',
		'http://user:pass@hostname.domain/services/marketing',
		'http://user:pass@hostname.domain/services/operation',
		'http://user:pass@hostname.domain/services/smartphone',
		'http://user:pass@hostname.domain/services/support',
		'http://user:pass@hostname.domain/services/web',
		'http://user:pass@hostname.domain/news/20181117/',
		'http://user:pass@hostname.domain/news/20190410/',
		'http://user:pass@hostname.domain/news/20191220/',
	].sort(pathComparator);
	expect(r).toStrictEqual([
		'http://user:pass@hostname.domain/',
		'http://user:pass@hostname.domain/company',
		'http://user:pass@hostname.domain/contact/',
		'http://user:pass@hostname.domain/news',
		'http://user:pass@hostname.domain/news/20181117',
		'http://user:pass@hostname.domain/news/20181117/',
		'http://user:pass@hostname.domain/news/20190410',
		'http://user:pass@hostname.domain/news/20190410/',
		'http://user:pass@hostname.domain/news/20191220',
		'http://user:pass@hostname.domain/news/20191220/',
		'http://user:pass@hostname.domain/policy',
		'http://user:pass@hostname.domain/privacy',
		'http://user:pass@hostname.domain/projects/xxxxxxx',
		'http://user:pass@hostname.domain/security',
		'http://user:pass@hostname.domain/services',
		'http://user:pass@hostname.domain/services/',
		'http://user:pass@hostname.domain/services/application',
		'http://user:pass@hostname.domain/services/branding',
		'http://user:pass@hostname.domain/services/communication',
		'http://user:pass@hostname.domain/services/interface',
		'http://user:pass@hostname.domain/services/marketing',
		'http://user:pass@hostname.domain/services/operation',
		'http://user:pass@hostname.domain/services/smartphone',
		'http://user:pass@hostname.domain/services/support',
		'http://user:pass@hostname.domain/services/web',
		'http://user:pass@hostname.domain/works',
	]);
});

test('Search query', () => {
	expect(
		[
			'https://hostname.domain/page/12',
			'https://hostname.domain/page/',
			'https://hostname.domain/page/?a=b',
			'https://hostname.domain/page',
			'https://hostname.domain/page?a=b',
			'https://hostname.domain/page/12?a=b',
		].sort(pathComparator),
	).toStrictEqual([
		'https://hostname.domain/page',
		'https://hostname.domain/page?a=b',
		'https://hostname.domain/page/',
		'https://hostname.domain/page/?a=b',
		'https://hostname.domain/page/12',
		'https://hostname.domain/page/12?a=b',
	]);
});
