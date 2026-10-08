import { Notice, Plugin } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';

import {
	hiddenFoldersHost,
	refreshExplorers,
	reindexMetadata,
	reloadEnabledPlugins,
} from './obsidian-host';
import { formatReport, runRebuild, type RebuildReport } from './rebuild';
import { REBUILD_VIEW_TYPE, RebuildSidebarView } from './sidebar';

export default class RebuildVaultIndexPlugin extends Plugin {
	private lastReport: RebuildReport | null = null;
	private busy = false;

	async onload(): Promise<void> {
		this.registerView(
			REBUILD_VIEW_TYPE,
			(leaf: WorkspaceLeaf): RebuildSidebarView => {
				return new RebuildSidebarView(leaf, this);
			},
		);
		this.addRibbonIcon('refresh-cw', 'Open rebuild sidebar', (): void => {
			void this.revealSidebar();
		});
		this.addCommand({
			id: 'open-rebuild-sidebar',
			name: 'Open rebuild sidebar',
			callback: (): void => {
				void this.revealSidebar();
			},
		});
		this.addCommand({
			id: 'rebuild-now',
			name: 'Rebuild vault index',
			callback: (): void => {
				void this.rebuildFromSidebar();
			},
		});
	}

	async revealSidebar(): Promise<void> {
		await this.app.workspace.ensureSideLeaf(REBUILD_VIEW_TYPE, 'right', {
			active: true,
			reveal: true,
		});
	}

	async rebuildFromSidebar(): Promise<void> {
		if (this.busy) {
			return;
		}
		this.busy = true;
		this.paintSidebars(null, true);
		try {
			const report = await runRebuild({
				hidden: hiddenFoldersHost(this.app),
				refreshExplorers: (): Promise<void> => refreshExplorers(this.app),
				reindexMetadata: (): Promise<void> => reindexMetadata(this.app),
				reloadPlugins: (): Promise<string[]> => reloadEnabledPlugins(this.app),
			});
			this.lastReport = report;
			new Notice(formatReport(report));
			this.paintSidebars(report, false);
		} finally {
			this.busy = false;
		}
	}

	private paintSidebars(report: RebuildReport | null, busy: boolean): void {
		const shown = report ?? this.lastReport;
		for (const leaf of this.app.workspace.getLeavesOfType(REBUILD_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof RebuildSidebarView) {
				view.render(busy ? null : shown, busy);
			}
		}
	}
}
