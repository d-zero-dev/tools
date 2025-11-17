/**
 *
 * @param impact
 */
export function detectSeverity(
	impact?: 'serious' | 'minor' | 'moderate' | 'critical' | null,
): 'high' | 'medium' | 'low' | null {
	if (!impact) {
		return null;
	}
	switch (impact) {
		case 'serious': {
			return 'high';
		}
		case 'minor': {
			return 'medium';
		}
		case 'moderate': {
			return 'low';
		}
		case 'critical': {
			return 'high';
		}
	}
}
