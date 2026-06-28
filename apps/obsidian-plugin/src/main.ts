import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, normalizePath } from 'obsidian';
import { projectBrain, conceptFilename, type BrainExport } from '@memoris/core';
import { startBridge, type Bridge } from './bridge.js';

interface MemorisSettings {
  folder: string;
  bridgePort: number;
  enableBridge: boolean;
}

const DEFAULTS: MemorisSettings = { folder: 'Memoris', bridgePort: 8765, enableBridge: true };

export default class MemorisPlugin extends Plugin {
  settings: MemorisSettings = DEFAULTS;
  private bridge?: Bridge;

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addSettingTab(new MemorisSettingTab(this.app, this));

    this.addRibbonIcon('book-open', 'Memoris: import vocabulary', () =>
      new ImportModal(this.app, this).open(),
    );
    this.addCommand({
      id: 'memoris-import-json',
      name: 'Import vocabulary from JSON',
      callback: () => new ImportModal(this.app, this).open(),
    });
    this.addCommand({
      id: 'memoris-open-graph',
      name: 'Open graph view',
      callback: () => {
        // Native graph view; the [[wikilinks]] in our notes form the vocabulary graph.
        (this.app as unknown as { commands: { executeCommandById(id: string): void } }).commands.executeCommandById(
          'graph:open',
        );
      },
    });

    if (this.settings.enableBridge) await this.restartBridge();
  }

  onunload(): void {
    this.bridge?.close();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async restartBridge(): Promise<void> {
    this.bridge?.close();
    this.bridge = undefined;
    if (!this.settings.enableBridge) return;
    try {
      this.bridge = await startBridge(this.settings.bridgePort, (data) => this.sync(data));
      console.info('[Memoris] bridge listening on', this.settings.bridgePort);
    } catch (e) {
      new Notice(`Memoris bridge failed to start: ${String(e)}`);
    }
  }

  /** Project a brain export into vault notes (losslessly). Returns the number of notes written. */
  async sync(data: BrainExport): Promise<number> {
    const folder = normalizePath(this.settings.folder || 'Memoris');
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(folder))) {
      await this.app.vault.createFolder(folder).catch(() => {});
    }

    // Pre-read existing notes so the pure projection can merge user notes losslessly.
    const existing = new Map<string, string>();
    for (const c of data.concepts) {
      const p = `${folder}/${conceptFilename(c.text)}`;
      if (await adapter.exists(p)) existing.set(p, await adapter.read(p));
    }

    const files = projectBrain(data, folder, (p) => existing.get(p));
    for (const f of files) await adapter.write(f.path, f.content);
    return files.length;
  }
}

class MemorisSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: MemorisPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Memoris' });

    new Setting(containerEl)
      .setName('Notes folder')
      .setDesc('Where concept notes are written in your vault.')
      .addText((t) =>
        t.setValue(this.plugin.settings.folder).onChange(async (v) => {
          this.plugin.settings.folder = v || 'Memoris';
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Enable bridge')
      .setDesc('Run a local server so the browser extension can push captures here automatically.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableBridge).onChange(async (v) => {
          this.plugin.settings.enableBridge = v;
          await this.plugin.saveSettings();
          await this.plugin.restartBridge();
        }),
      );

    new Setting(containerEl)
      .setName('Bridge port')
      .setDesc('Must match the extension setting (default 8765).')
      .addText((t) =>
        t.setValue(String(this.plugin.settings.bridgePort)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) {
            this.plugin.settings.bridgePort = n;
            await this.plugin.saveSettings();
            await this.plugin.restartBridge();
          }
        }),
      );
  }
}

class ImportModal extends Modal {
  constructor(
    app: App,
    private plugin: MemorisPlugin,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Import Memoris vocabulary' });
    contentEl.createEl('p', {
      text: 'Paste the JSON exported from the Memoris extension (popup → Export brain).',
      cls: 'setting-item-description',
    });
    const ta = contentEl.createEl('textarea');
    ta.style.width = '100%';
    ta.style.height = '160px';
    ta.placeholder = '{ "version": 1, "concepts": [...], ... }';

    const btn = contentEl.createEl('button', { text: 'Import & build graph' });
    btn.style.marginTop = '8px';
    btn.onclick = async () => {
      try {
        const data = JSON.parse(ta.value) as BrainExport;
        const n = await this.plugin.sync(data);
        new Notice(`Memoris: wrote ${n} note(s). Open the graph to see the connections.`);
        this.close();
      } catch (e) {
        new Notice(`Import failed: ${String(e)}`);
      }
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
