/**
 * Whether `className` matches any of `patterns` (auto-generated/hash-like class names).
 * @param className
 * @param patterns
 */
export function isNoiseClass(className: string, patterns: readonly RegExp[]): boolean {
	return patterns.some((pattern) => pattern.test(className));
}
