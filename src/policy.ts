/** Same names Nested Hidden Folders / the vault kit index on disk. */
export const SKIP_HIDDEN = new Set([
	'.obsidian',
	'.git',
	'.DS_Store',
	'.trash',
	'.Trash',
]);

export const NESTED_ENABLE = new Set(['.grok', '.pi', '.v2']);

/**
 * Root-level dot-folders (except skip) and nested `.grok` / `.pi` / `.v2`.
 */
export function shouldAutoIndex(path: string): boolean {
	const trimmed = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
	if (trimmed.length === 0) {
		return false;
	}
	const parts = trimmed.split('/');
	const name = parts[parts.length - 1];
	if (name === undefined || SKIP_HIDDEN.has(name)) {
		return false;
	}
	if (parts.length === 1) {
		return name.startsWith('.');
	}
	return NESTED_ENABLE.has(name);
}
