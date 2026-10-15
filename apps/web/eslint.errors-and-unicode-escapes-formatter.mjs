import { ESLint } from 'eslint';
import formatUnicodeEscapes from './eslint.unicode-escapes-formatter.mjs';

export default async function format(results) {
	const stylishFormatter = await new ESLint().loadFormatter('stylish');
	const errorReport = await stylishFormatter.format(ESLint.getErrorResults(results));
	const unicodeEscapesReport = formatUnicodeEscapes(results);

	// Keeps the blank line the ESLint CLI printed between the two reports when they ran as separate passes.
	return errorReport && unicodeEscapesReport
		? `${errorReport}\n${unicodeEscapesReport}`
		: `${errorReport}${unicodeEscapesReport}`;
}
