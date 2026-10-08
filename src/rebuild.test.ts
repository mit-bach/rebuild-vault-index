import { describe, expect, it } from 'vitest';

import {
	formatReport,
	pluginIdsToReload,
	runRebuild,
	type HiddenFoldersHost,
} from './rebuild';

function fakeHidden(initial: string[], listed: string[]): HiddenFoldersHost {
	let enabled = [...initial];
	return {
		listHiddenFolders: async (): Promise<string[]> => listed,
		enabledFolders: (): readonly string[] => enabled,
		setFolderEnabled: async (path: string, on: boolean): Promise<void> => {
			if (on && !enabled.includes(path)) {
				enabled = [...enabled, path];
				return;
			}
			if (!on) {
				enabled = enabled.filter((item: string): boolean => item !== path);
			}
		},
		reindexEnabled: async (): Promise<string[]> => enabled,
	};
}

describe('runRebuild', () => {
	it('enables kit hidden folders and reindexes them', async () => {
		const hidden = fakeHidden(['.grok'], ['.grok', 'classes/.grok', 'repo/.github']);
		const report = await runRebuild({
			hidden,
			refreshExplorers: async (): Promise<void> => undefined,
			reindexMetadata: async (): Promise<void> => undefined,
			reloadPlugins: async (): Promise<string[]> => ['mixed-explorer-sort'],
		});
		expect(report.ok).toBe(true);
		expect(report.hiddenEnabled).toEqual(['.grok', 'classes/.grok']);
		expect(report.hiddenIndexed).toEqual(['.grok', 'classes/.grok']);
		expect(report.pluginsReloaded).toEqual(['mixed-explorer-sort']);
		expect(hidden.enabledFolders()).toEqual(['.grok', 'classes/.grok']);
	});

	it('records a missing nested-hidden-folders host and still refreshes', async () => {
		let explorers = 0;
		let metadata = 0;
		let plugins = 0;
		const report = await runRebuild({
			hidden: null,
			refreshExplorers: async (): Promise<void> => {
				explorers += 1;
			},
			reindexMetadata: async (): Promise<void> => {
				metadata += 1;
			},
			reloadPlugins: async (): Promise<string[]> => {
				plugins += 1;
				return ['copy-selected-paths'];
			},
		});
		expect(report.ok).toBe(false);
		expect(report.errors[0]).toContain('Nested Hidden Folders');
		expect(explorers).toBe(1);
		expect(metadata).toBe(1);
		expect(plugins).toBe(1);
		expect(report.pluginsReloaded).toEqual(['copy-selected-paths']);
	});
});

describe('pluginIdsToReload', () => {
	it('skips the rebuild plugin itself', () => {
		expect(
			pluginIdsToReload(
				['a', 'rebuild-vault-index', 'b'],
				['rebuild-vault-index'],
			),
		).toEqual(['a', 'b']);
	});
});

describe('formatReport', () => {
	it('summarizes a successful reindex', () => {
		expect(
			formatReport({
				ok: true,
				hiddenIndexed: ['.grok'],
				hiddenEnabled: ['.grok'],
				pluginsReloaded: ['a', 'b'],
				errors: [],
			}),
		).toBe(
			'Reindexed 1 hidden folder. File tree and metadata cache refreshed. Reloaded 2 plugins.',
		);
	});
});
