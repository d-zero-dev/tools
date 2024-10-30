import type { AxeRuleId, Explanation } from './types.js';
import type { Style } from '@d-zero/a11y-check-core';
import type { NodeResult } from 'axe-core';

import { colorContrastCheck, ColorContrastError } from '@d-zero/a11y-check-core';

import { br, p } from './pargraph.js';

export function inferExplanation(
	id: AxeRuleId,
	node: NodeResult,
	style: Style | null,
): Explanation | null {
	switch (id) {
		case 'accesskeys': {
			return null;
		}
		case 'area-alt': {
			return {
				main: 'alt属性に「______」を設定してください。',
				help: '',
			};
		}
		case 'aria-allowed-attr': {
			return {
				main: 'aria属性に「______」を設定してください。',
				help: '',
			};
		}
		case 'aria-allowed-role': {
			return null;
		}
		case 'aria-braille-equivalent': {
			return null;
		}
		case 'aria-command-name': {
			return null;
		}
		case 'aria-conditional-attr': {
			return null;
		}
		case 'aria-deprecated-role': {
			return null;
		}
		case 'aria-dialog-name': {
			return null;
		}
		case 'aria-hidden-body': {
			return null;
		}
		case 'aria-hidden-focus': {
			return null;
		}
		case 'aria-input-field-name': {
			return null;
		}
		case 'aria-meter-name': {
			return null;
		}
		case 'aria-progressbar-name': {
			return null;
		}
		case 'aria-prohibited-attr': {
			return null;
		}
		case 'aria-required-attr': {
			return null;
		}
		case 'aria-required-children': {
			return null;
		}
		case 'aria-required-parent': {
			return null;
		}
		case 'aria-roledescription': {
			return null;
		}
		case 'aria-roles': {
			return null;
		}
		case 'aria-text': {
			return null;
		}
		case 'aria-toggle-field-name': {
			return null;
		}
		case 'aria-tooltip-name': {
			return null;
		}
		case 'aria-treeitem-name': {
			return null;
		}
		case 'aria-valid-attr-value': {
			return null;
		}
		case 'aria-valid-attr': {
			return null;
		}
		case 'audio-caption': {
			return null;
		}
		case 'autocomplete-valid': {
			return null;
		}
		case 'avoid-inline-spacing': {
			return null;
		}
		case 'blink': {
			return null;
		}
		case 'button-name': {
			return null;
		}
		case 'bypass': {
			return null;
		}
		case 'color-contrast-enhanced': {
			return null;
		}
		case 'color-contrast': {
			if (node.any?.[0]) {
				let main = '';
				let contrastResult = style ? colorContrastCheck(style) : null;
				let needCheck: 'N/A' | 'WARNING' | null = null;
				let message: string | null = null;

				switch (contrastResult) {
					case null: {
						needCheck = 'N/A';
						message = '要素のスタイル取得に失敗しました。';
						break;
					}
					case ColorContrastError.DOES_NOT_DETERMINE_FOREGROUND: {
						needCheck = 'N/A';
						message = 'フォントの色が判定できません。';
						break;
					}
					case ColorContrastError.DOES_NOT_DETERMINE_BACKGROUND: {
						needCheck = 'WARNING';
						message = '背景色が判定できないかったので#FFFFFFとして判定しています。';

						contrastResult = style
							? colorContrastCheck({
									...style,
									backgroundColor: 'rgb(255, 255, 255)',
								})
							: null;
						break;
					}
					case ColorContrastError.FOREGROUND_COLOR_HAS_ALPHA: {
						needCheck = 'N/A';
						message = 'フォントの色に透明度が設定されています。';
						break;
					}
					case ColorContrastError.BACKGROUND_COLOR_HAS_ALPHA: {
						needCheck = 'N/A';
						message = '背景色に透明度が設定されています。';
						break;
					}
					default: {
						if (node.any[0].message.includes('判定できません')) {
							needCheck = 'WARNING';
						}
						if (contrastResult.AA === false) {
							main = p(
								'AAのコントラスト比を満たしていません。',
								br(
									`前景色: ${contrastResult.foreground.hex}`,
									`背景色: ${contrastResult.background.hex}`,
									`コントラスト比: ${contrastResult.ratioText}`,
								),
								'コントラスト比は4.5:1を満たすようにしてください。',
							);
						}
					}
				}

				return {
					main,
					help: p(
						needCheck ? `${needCheck} 目視で確認してください。` : null,
						node.any[0].message,
						message,
						typeof contrastResult === 'number'
							? null
							: br(
									`前景色: ${contrastResult?.foreground.hex ?? '判定不可'}`,
									`背景色: ${contrastResult?.background.hex ?? '判定不可'}`,
									`コントラスト比: ${contrastResult?.ratioText ?? '判定不可'}`,
									`AA: ${contrastResult?.AA ? '適合' : '不適合'}`,
									`AAA: ${contrastResult?.AAA ? '適合' : '不適合'}`,
								),
						br(
							`font-size: ${node.any[0].data.fontSize}`,
							`font-weight: ${node.any[0].data.fontWeight}`,
							`color: ${style?.color ?? null}`,
							`background-color: ${style?.backgroundColor ?? null}`,
							`background-image: ${style?.backgroundImage ?? null}`,
							`先祖要素 background-color: ${style?.closestBackgroundColor ?? null}`,
							`先祖要素 background-image: ${style?.closestBackgroundImage ?? null}`,
						),
					),
				};
			}

			return null;
		}
		case 'css-orientation-lock': {
			return null;
		}
		case 'definition-list': {
			return null;
		}
		// cspell:disable-next-line
		case 'dlitem': {
			return null;
		}
		case 'document-title': {
			return null;
		}
		case 'duplicate-id-active': {
			return null;
		}
		case 'duplicate-id-aria': {
			return null;
		}
		case 'duplicate-id': {
			return null;
		}
		case 'empty-heading': {
			return null;
		}
		case 'empty-table-header': {
			// td要素に変更してください。
			return null;
		}
		case 'focus-order-semantics': {
			return null;
		}
		case 'form-field-multiple-labels': {
			// 「性別」のラベルはfieldset/legend要素をつかって複数のラジオボタンをグルーピングするように修正してください。
			return null;
		}
		case 'frame-focusable-content': {
			return null;
		}
		case 'frame-tested': {
			return null;
		}
		case 'frame-title-unique': {
			return null;
		}
		case 'frame-title': {
			return null;
		}
		case 'heading-order': {
			return null;
		}
		case 'hidden-content': {
			return null;
		}
		case 'html-has-lang': {
			return {
				main: 'html要素にlang属性を設定してください。日本語の場合は「ja」、英語の場合は「en」を設定してください。',
				help: '',
			};
		}
		case 'html-lang-valid': {
			return null;
		}
		case 'html-xml-lang-mismatch': {
			return null;
		}
		case 'identical-links-same-purpose': {
			return null;
		}
		case 'image-alt': {
			return null;
		}
		case 'image-redundant-alt': {
			return null;
		}
		case 'input-button-name': {
			return null;
		}
		case 'input-image-alt': {
			return null;
		}
		case 'label-content-name-mismatch': {
			return null;
		}
		case 'label-title-only': {
			return null;
		}
		case 'label': {
			return null;
		}
		case 'landmark-banner-is-top-level': {
			return null;
		}
		case 'landmark-complementary-is-top-level': {
			return null;
		}
		case 'landmark-contentinfo-is-top-level': {
			return null;
		}
		case 'landmark-main-is-top-level': {
			return null;
		}
		case 'landmark-no-duplicate-banner': {
			return null;
		}
		case 'landmark-no-duplicate-contentinfo': {
			return null;
		}
		case 'landmark-no-duplicate-main': {
			return null;
		}
		case 'landmark-one-main': {
			return {
				main: 'ページのメインコンテンツをmain要素で囲んでください。header要素やfooter要素とは別の領域が望ましいです。',
				help: '',
			};
		}
		case 'landmark-unique': {
			return null;
		}
		case 'link-in-text-block': {
			return null;
		}
		case 'link-name': {
			return null;
		}
		case 'list': {
			return null;
		}
		case 'listitem': {
			return null;
		}
		case 'marquee': {
			return null;
		}
		case 'meta-refresh-no-exceptions': {
			return null;
		}
		case 'meta-refresh': {
			return null;
		}
		case 'meta-viewport-large': {
			return null;
		}
		case 'meta-viewport': {
			return null;
		}
		case 'nested-interactive': {
			return null;
		}
		case 'no-autoplay-audio': {
			return null;
		}
		case 'object-alt': {
			return null;
		}
		case 'p-as-heading': {
			return null;
		}
		case 'page-has-heading-one': {
			return null;
		}
		case 'presentation-role-conflict': {
			return null;
		}
		case 'region': {
			return {
				main: 'main要素、header要素、footer要素などのランドマーク要素のいずれかの中にあるようにしてください。',
				help: '',
			};
		}
		case 'role-img-alt': {
			return null;
		}
		case 'scope-attr-valid': {
			return null;
		}
		case 'scrollable-region-focusable': {
			// tabindex="0"を設定してください。
			return null;
		}
		case 'select-name': {
			return null;
		}
		case 'server-side-image-map': {
			return null;
		}
		case 'skip-link': {
			return null;
		}
		case 'summary-name': {
			return null;
		}
		case 'svg-img-alt': {
			return null;
		}
		case 'tabindex': {
			return null;
		}
		case 'table-duplicate-name': {
			return null;
		}
		case 'table-fake-caption': {
			return null;
		}
		case 'target-size': {
			return null;
		}
		case 'td-has-header': {
			return null;
		}
		case 'td-headers-attr': {
			return null;
		}
		case 'th-has-data-cells': {
			return null;
		}
		case 'valid-lang': {
			return null;
		}
		case 'video-caption': {
			return null;
		}
	}
}
