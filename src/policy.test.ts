import { describe, expect, it } from 'vitest';

import { shouldAutoIndex } from './policy';

describe('shouldAutoIndex', () => {
	it('enables root hidden folders except skip names', () => {
		expect(shouldAutoIndex('.grok')).toBe(true);
		expect(shouldAutoIndex('.pi')).toBe(true);
		expect(shouldAutoIndex('.openclaw')).toBe(true);
		expect(shouldAutoIndex('.obsidian')).toBe(false);
		expect(shouldAutoIndex('.git')).toBe(false);
	});

	it('enables nested grok/pi/v2 only', () => {
		expect(shouldAutoIndex('classes/.grok')).toBe(true);
		expect(shouldAutoIndex('Harness/.pi')).toBe(true);
		expect(shouldAutoIndex('repo/.v2')).toBe(true);
		expect(shouldAutoIndex('repo/.github')).toBe(false);
		expect(shouldAutoIndex('repo/.vscode')).toBe(false);
	});

	it('rejects empty and non-hidden paths', () => {
		expect(shouldAutoIndex('')).toBe(false);
		expect(shouldAutoIndex('classes')).toBe(false);
		expect(shouldAutoIndex('/')).toBe(false);
	});
});
