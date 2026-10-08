import { ItemView } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';

import type RebuildVaultIndexPlugin from './main';
import { formatReport, type RebuildReport } from './rebuild';

export const REBUILD_VIEW_TYPE = 'rebuild-vault-index-sidebar';

export class RebuildSidebarView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: RebuildVaultIndexPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return REBUILD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Rebuild index';
	}

	getIcon(): string {
		return 'refresh-cw';
	}

	async onOpen(): Promise<void> {
		this.render(null, false);
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	render(report: RebuildReport | null, busy: boolean): void {
		this.contentEl.empty();
		this.contentEl.addClass('rebuild-vault-index-sidebar');
		this.contentEl.createEl('h4', { text: 'Rebuild vault index' });
		this.contentEl.createEl('p', {
			cls: 'rebuild-vault-index-lead',
			text: 'Rescan hidden folders, refresh the file tree, reindex the metadata cache, and reload community plugins.',
		});
		const actions = this.contentEl.createDiv({
			cls: 'rebuild-vault-index-actions',
		});
		const button = actions.createEl('button', {
			cls: 'mod-cta',
			text: busy ? 'Rebuilding…' : 'Rebuild now',
		});
		button.disabled = busy;
		button.addEventListener('click', (): void => {
			if (busy) {
				return;
			}
			void this.plugin.rebuildFromSidebar();
		});
		const status = this.contentEl.createEl('p', {
			cls: 'rebuild-vault-index-status',
		});
		if (busy) {
			status.setText('Working…');
			return;
		}
		if (report === null) {
			status.setText('Press Rebuild now. You do not need Settings.');
			return;
		}
		if (!report.ok) {
			status.addClass('is-error');
		}
		status.setText(formatReport(report));
		if (report.hiddenIndexed.length > 0) {
			this.contentEl.createEl('p', {
				cls: 'rebuild-vault-index-paths',
				text: report.hiddenIndexed.join('\n'),
			});
		}
	}
}
