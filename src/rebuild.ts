import { shouldAutoIndex } from './policy';

export interface HiddenFoldersHost {
	listHiddenFolders(): Promise<string[]>;
	enabledFolders(): readonly string[];
	setFolderEnabled(path: string, enabled: boolean): Promise<void>;
	reindexEnabled(): Promise<string[]>;
}

export interface RebuildDeps {
	hidden: HiddenFoldersHost | null;
	refreshExplorers(): Promise<void>;
	reindexMetadata(): Promise<void>;
	reloadPlugins(): Promise<string[]>;
}

export interface RebuildReport {
	ok: boolean;
	hiddenIndexed: string[];
	hiddenEnabled: string[];
	pluginsReloaded: string[];
	errors: string[];
}

export const REBUILD_PLUGIN_ID = 'rebuild-vault-index';

export function pluginIdsToReload(
	enabled: readonly string[],
	skip: readonly string[],
): string[] {
	const blocked = new Set(skip);
	return enabled.filter((id: string): boolean => !blocked.has(id));
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function runRebuild(deps: RebuildDeps): Promise<RebuildReport> {
	const errors: string[] = [];
	let hiddenEnabled: string[] = [];
	let hiddenIndexed: string[] = [];
	let pluginsReloaded: string[] = [];
	if (deps.hidden === null) {
		errors.push('Nested Hidden Folders is not enabled');
	} else {
		try {
			const found = await deps.hidden.listHiddenFolders();
			const already = new Set(deps.hidden.enabledFolders());
			hiddenEnabled = found.filter((path: string): boolean => {
				return shouldAutoIndex(path);
			});
			for (const path of hiddenEnabled) {
				if (!already.has(path)) {
					await deps.hidden.setFolderEnabled(path, true);
				}
			}
			hiddenIndexed = await deps.hidden.reindexEnabled();
		} catch (error: unknown) {
			errors.push(`Hidden folders: ${errorMessage(error)}`);
		}
	}
	try {
		await deps.refreshExplorers();
	} catch (error: unknown) {
		errors.push(`File explorer: ${errorMessage(error)}`);
	}
	try {
		await deps.reindexMetadata();
	} catch (error: unknown) {
		errors.push(`Metadata cache: ${errorMessage(error)}`);
	}
	try {
		pluginsReloaded = await deps.reloadPlugins();
	} catch (error: unknown) {
		errors.push(`Plugins: ${errorMessage(error)}`);
	}
	return {
		ok: errors.length === 0,
		hiddenIndexed,
		hiddenEnabled,
		pluginsReloaded,
		errors,
	};
}

export function formatReport(report: RebuildReport): string {
	if (report.ok) {
		const n = report.hiddenIndexed.length;
		const p = report.pluginsReloaded.length;
		return `Reindexed ${n} hidden folder${n === 1 ? '' : 's'}. File tree and metadata cache refreshed. Reloaded ${p} plugin${p === 1 ? '' : 's'}.`;
	}
	return report.errors.join('\n');
}
