import type { App, TFile } from 'obsidian';

import {
	pluginIdsToReload,
	REBUILD_PLUGIN_ID,
	type HiddenFoldersHost,
} from './rebuild';

interface PluginRegistry {
	getPlugin: (id: string) => unknown;
}

interface SortableView {
	requestSort?: () => void;
}

interface MetadataCacheWork {
	initialize?: () => Promise<void> | void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function asFunction(
	value: unknown,
): ((this: unknown, ...args: unknown[]) => unknown) | null {
	return typeof value === 'function'
		? (value as (this: unknown, ...args: unknown[]) => unknown)
		: null;
}

export function hiddenFoldersHost(app: App): HiddenFoldersHost | null {
	const plugins = (app as App & { plugins?: PluginRegistry }).plugins;
	if (plugins === undefined) {
		return null;
	}
	const raw = plugins.getPlugin('nested-hidden-folders');
	if (!isRecord(raw)) {
		return null;
	}
	const listHidden = asFunction(raw['listHiddenFolders']);
	const enabled = asFunction(raw['enabledFolders']);
	const setEnabled = asFunction(raw['setFolderEnabled']);
	const reindex = asFunction(raw['reindexEnabled']);
	if (
		listHidden === null ||
		enabled === null ||
		setEnabled === null ||
		reindex === null
	) {
		return null;
	}
	return {
		listHiddenFolders: (): Promise<string[]> => {
			return Promise.resolve(listHidden.call(raw) as Promise<string[]>);
		},
		enabledFolders: (): readonly string[] => {
			const listed = enabled.call(raw);
			return Array.isArray(listed)
				? listed.filter((item): item is string => typeof item === 'string')
				: [];
		},
		setFolderEnabled: (path: string, on: boolean): Promise<void> => {
			return Promise.resolve(
				setEnabled.call(raw, path, on) as Promise<void>,
			);
		},
		reindexEnabled: (): Promise<string[]> => {
			return Promise.resolve(reindex.call(raw) as Promise<string[]>);
		},
	};
}

export async function refreshExplorers(app: App): Promise<void> {
	const leaves = app.workspace.getLeavesOfType('file-explorer');
	for (const leaf of leaves) {
		const view = leaf.view as SortableView;
		view.requestSort?.();
	}
}

export async function reindexMetadata(app: App): Promise<void> {
	const cache = app.metadataCache as MetadataCacheWork & App['metadataCache'];
	if (typeof cache.initialize === 'function') {
		await cache.initialize();
		return;
	}
	const files: TFile[] = app.vault.getMarkdownFiles();
	for (const file of files) {
		cache.getFileCache(file);
	}
}

interface PluginReloader {
	disablePlugin: (id: string) => Promise<unknown>;
	enablePlugin: (id: string) => Promise<unknown>;
	enabledPlugins?: Iterable<string>;
	plugins?: Record<string, unknown>;
}

function pluginReloader(app: App): PluginReloader | null {
	const plugins = (app as App & { plugins?: unknown }).plugins;
	if (!isRecord(plugins)) {
		return null;
	}
	const disablePlugin = asFunction(plugins['disablePlugin']);
	const enablePlugin = asFunction(plugins['enablePlugin']);
	if (disablePlugin === null || enablePlugin === null) {
		return null;
	}
	const enabledRaw = plugins['enabledPlugins'];
	const loaded = plugins['plugins'];
	return {
		disablePlugin: (id: string): Promise<unknown> => {
			return Promise.resolve(disablePlugin.call(plugins, id));
		},
		enablePlugin: (id: string): Promise<unknown> => {
			return Promise.resolve(enablePlugin.call(plugins, id));
		},
		enabledPlugins: enabledRaw instanceof Set ? enabledRaw : undefined,
		plugins: isRecord(loaded) ? loaded : undefined,
	};
}

function enabledPluginIds(reloader: PluginReloader): string[] {
	if (reloader.enabledPlugins !== undefined) {
		return [...reloader.enabledPlugins].filter(
			(id: unknown): id is string => typeof id === 'string',
		);
	}
	if (reloader.plugins !== undefined) {
		return Object.keys(reloader.plugins);
	}
	return [];
}

export async function reloadEnabledPlugins(app: App): Promise<string[]> {
	const reloader = pluginReloader(app);
	if (reloader === null) {
		throw new Error('Plugin manager is not available');
	}
	const ids = pluginIdsToReload(enabledPluginIds(reloader), [REBUILD_PLUGIN_ID]);
	const reloaded: string[] = [];
	for (const id of ids) {
		try {
			await reloader.disablePlugin(id);
			await reloader.enablePlugin(id);
			reloaded.push(id);
		} catch {
			try {
				await reloader.enablePlugin(id);
			} catch {
				// Leave disabled plugins for the next app reload.
			}
		}
	}
	return reloaded;
}
