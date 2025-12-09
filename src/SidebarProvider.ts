import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.create-it');
const TEMPLATES_FILE = path.join(CONFIG_DIR, 'templates.json');

export class SidebarProvider implements vscode.WebviewViewProvider {
	_view?: vscode.WebviewView;
	_doc?: vscode.TextDocument;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case 'getSettings': {
					this.sendSettings();
					break;
				}
				case 'getTemplates': {
					this.sendTemplates();
					break;
				}
				case 'updateDefaultPath': {
					await this.updateDefaultPath(data.value);
					break;
				}
				case 'browseDefaultPath': {
					await this.browseDefaultPath();
					break;
				}
				case 'saveTemplates': {
					await this.saveTemplates(data.value);
					break;
				}
				case 'openTemplatesFile': {
					await this.openTemplatesFile();
					break;
				}
				case 'createProject': {
					await vscode.commands.executeCommand('create-it.createProject');
					break;
				}
				case 'addTemplate': {
					this.addTemplateForm();
					break;
				}
			}
		});

		this.sendSettings();
		this.sendTemplates();
	}

	private async sendSettings() {
		const config = vscode.workspace.getConfiguration('projectTemplateManager');
		const defaultPath = config.get<string>('defaultPath') || os.homedir();

		this._view?.webview.postMessage({
			type: 'settings',
			defaultPath: defaultPath,
			templatesPath: TEMPLATES_FILE,
		});
	}

	private async sendTemplates() {
		try {
			const content = fs.readFileSync(TEMPLATES_FILE, 'utf8');
			const templates = JSON.parse(content);

			this._view?.webview.postMessage({
				type: 'templates',
				templates: templates,
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to load templates: ${error}`);
		}
	}

	private async updateDefaultPath(newPath: string) {
		const config = vscode.workspace.getConfiguration('projectTemplateManager');
		await config.update(
			'defaultPath',
			newPath,
			vscode.ConfigurationTarget.Global
		);
		vscode.window.showInformationMessage(`✅ Default path updated: ${newPath}`);
		this.sendSettings();
	}

	private async browseDefaultPath() {
		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Default Project Path',
		});

		if (result && result[0]) {
			await this.updateDefaultPath(result[0].fsPath);
		}
	}

	private async saveTemplates(templatesJson: string) {
		try {
			// Validate JSON
			JSON.parse(templatesJson);

			// Save to file
			fs.writeFileSync(TEMPLATES_FILE, templatesJson);
			vscode.window.showInformationMessage('✅ Templates saved successfully!');
			this.sendTemplates();
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save templates: ${error}`);
		}
	}

	private async openTemplatesFile() {
		const uri = vscode.Uri.file(TEMPLATES_FILE);
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document);
	}

	private async addTemplateForm() {
		const category = await vscode.window.showInputBox({
			prompt: 'Enter category name (e.g., react, python, node)',
			placeHolder: 'react',
		});
		if (!category) return;

		const name = await vscode.window.showInputBox({
			prompt: 'Enter template name',
			placeHolder: 'my-template',
		});
		if (!name) return;

		const description = await vscode.window.showInputBox({
			prompt: 'Enter description',
			placeHolder: 'A brief description of your template',
		});
		if (!description) return;

		const repo = await vscode.window.showInputBox({
			prompt: 'Enter git repository URL',
			placeHolder: 'https://github.com/user/repo.git',
		});
		if (!repo) return;

		const postInstall = await vscode.window.showInputBox({
			prompt: 'Enter post-install command',
			placeHolder: 'npm install',
		});
		if (!postInstall) return;

		// Read current templates
		const content = fs.readFileSync(TEMPLATES_FILE, 'utf8');
		const templates = JSON.parse(content);

		// Add new template
		if (!templates[category]) {
			templates[category] = {};
		}

		templates[category][name] = {
			description: description,
			homepage: '',
			authors: [{ name: 'Custom', url: '' }],
			'git-repository': repo,
			'post-install': postInstall,
		};

		// Save
		fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
		vscode.window.showInformationMessage(
			`✅ Template "${name}" added to "${category}"!`
		);
		this.sendTemplates();
	}

	public revive(panel: vscode.WebviewView) {
		this._view = panel;
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create It</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            font-size: 13px;
        }

        h2 {
            font-size: 16px;
            margin-bottom: 16px;
            color: var(--vscode-foreground);
            font-weight: 600;
        }

        h3 {
            font-size: 14px;
            margin: 20px 0 12px 0;
            color: var(--vscode-foreground);
            font-weight: 500;
        }

        .section {
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .section:last-child {
            border-bottom: none;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 14px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
            width: 100%;
            margin-bottom: 8px;
            transition: background-color 0.2s;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        input {
            width: 100%;
            padding: 6px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 13px;
            margin-bottom: 8px;
        }

        input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .path-input-group {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }

        .path-input-group input {
            flex: 1;
            margin-bottom: 0;
        }

        .path-input-group button {
            width: auto;
            margin-bottom: 0;
            padding: 6px 12px;
        }

        .info-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
            line-height: 1.5;
        }

        .template-count {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 11px;
            font-size: 11px;
            display: inline-block;
            margin-left: 8px;
        }

        .template-list {
            max-height: 300px;
            overflow-y: auto;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .template-category {
            margin-bottom: 16px;
        }

        .category-title {
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 8px;
            font-size: 13px;
        }

        .template-item {
            padding: 8px;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 3px;
            margin-bottom: 6px;
            font-size: 12px;
        }

        .template-name {
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        .template-desc {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-top: 4px;
        }

        .icon {
            margin-right: 6px;
        }

        textarea {
            width: 100%;
            min-height: 200px;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
            resize: vertical;
            margin-bottom: 8px;
        }

        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .json-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
    </style>
</head>
<body>
    <div class="section">
        <h2>🚀 Quick Actions</h2>
        <button onclick="createProject()">
            <span class="icon">📦</span> Create New Project
        </button>
        <button class="secondary" onclick="addTemplate()">
            <span class="icon">➕</span> Add Template
        </button>
    </div>

    <div class="section">
        <h2>⚙️ Settings</h2>
        <h3>Default Project Path</h3>
        <div class="info-text">Where new projects will be created by default</div>
        <div class="path-input-group">
            <input type="text" id="defaultPath" placeholder="Enter path..." />
            <button onclick="browseDefaultPath()">📁</button>
        </div>
        <button class="secondary" onclick="updateDefaultPath()">
            <span class="icon">💾</span> Save Path
        </button>
    </div>

    <div class="section">
        <h2>📚 Templates <span class="template-count" id="templateCount">0</span></h2>
        <div class="template-list" id="templateList">
            <div style="text-align: center; color: var(--vscode-descriptionForeground);">
                Loading templates...
            </div>
        </div>
        <button class="secondary" onclick="openTemplatesFile()">
            <span class="icon">📝</span> Edit Templates File
        </button>
    </div>

    <div class="section">
        <h2>🔧 JSON Editor</h2>
        <div class="info-text">Edit templates.json directly</div>
        <textarea id="jsonEditor" placeholder="Loading templates..."></textarea>
        <div class="json-actions">
            <button onclick="saveTemplates()">
                <span class="icon">💾</span> Save
            </button>
            <button class="secondary" onclick="formatJson()">
                <span class="icon">✨</span> Format
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'settings':
                    document.getElementById('defaultPath').value = message.defaultPath;
                    break;
                case 'templates':
                    displayTemplates(message.templates);
                    document.getElementById('jsonEditor').value = JSON.stringify(message.templates, null, 2);
                    break;
            }
        });

        function displayTemplates(templates) {
            const listEl = document.getElementById('templateList');
            const countEl = document.getElementById('templateCount');
            
            let html = '';
            let totalCount = 0;

            for (const [category, items] of Object.entries(templates)) {
                html += '<div class="template-category">';
                html += '<div class="category-title">📂 ' + category + '</div>';
                
                for (const [name, template] of Object.entries(items)) {
                    html += '<div class="template-item">';
                    html += '<div class="template-name">' + name + '</div>';
                    html += '<div class="template-desc">' + template.description + '</div>';
                    html += '</div>';
                    totalCount++;
                }
                
                html += '</div>';
            }

            listEl.innerHTML = html || '<div style="text-align: center; color: var(--vscode-descriptionForeground);">No templates found</div>';
            countEl.textContent = totalCount;
        }

        function createProject() {
            vscode.postMessage({ type: 'createProject' });
        }

        function addTemplate() {
            vscode.postMessage({ type: 'addTemplate' });
        }

        function updateDefaultPath() {
            const path = document.getElementById('defaultPath').value;
            vscode.postMessage({ type: 'updateDefaultPath', value: path });
        }

        function browseDefaultPath() {
            vscode.postMessage({ type: 'browseDefaultPath' });
        }

        function saveTemplates() {
            const json = document.getElementById('jsonEditor').value;
            try {
                JSON.parse(json);
                vscode.postMessage({ type: 'saveTemplates', value: json });
            } catch (e) {
                alert('Invalid JSON: ' + e.message);
            }
        }

        function formatJson() {
            const editor = document.getElementById('jsonEditor');
            try {
                const obj = JSON.parse(editor.value);
                editor.value = JSON.stringify(obj, null, 2);
            } catch (e) {
                alert('Invalid JSON: ' + e.message);
            }
        }

        function openTemplatesFile() {
            vscode.postMessage({ type: 'openTemplatesFile' });
        }

        // Request initial data
        vscode.postMessage({ type: 'getSettings' });
        vscode.postMessage({ type: 'getTemplates' });
    </script>
</body>
</html>`;
	}
}
