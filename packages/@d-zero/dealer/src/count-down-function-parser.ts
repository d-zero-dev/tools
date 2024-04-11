export function countDownFunctionParser(text: string) {
	const matched =
		/%countdown\((?<time>\d+)\s*,\s*(?<id>[^\s),]+)(?:\s*,\s*(?<unit>m?s))?\)%/i.exec(
			text,
		);

	if (!matched) {
		return null;
	}

	if (!matched[0] || !matched.groups?.time || !matched.groups?.id) {
		return null;
	}

	const time = Number.parseInt(matched.groups?.time, 10);

	if (Number.isNaN(time)) {
		return null;
	}

	const unit = matched.groups?.unit === 's' ? 's' : 'ms';
	const id = matched.groups?.id;
	const placeholder = matched[0];

	return {
		id,
		time,
		placeholder,
		unit,
	};
}
