import vscode from 'vscode';
import fs from 'fs';
import os from 'os';
import { config } from '@/config';
const { templatesFile } = config;

export class SidebarProvider implements vscode.WebviewViewProvider {
	_view?: vscode.WebviewView;
	_doc?: vscode.TextDocument;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public async resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = 'Loading sidebar...';
		try {
			const response = await fetch(config.sidebarUrl);
			if (response.ok) {
				const html = await response.text();
				webviewView.webview.html = html;
			} else {
				throw new Error(
					`Failed to load sidebar content: ${response.statusText}`
				);
			}
		} catch (error) {
			webviewView.webview.html = `Error loading sidebar content: ${error}`;
		}

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
			templatesPath: templatesFile,
		});
	}

	private async sendTemplates() {
		try {
			const content = fs.readFileSync(templatesFile, 'utf8');
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
			fs.writeFileSync(templatesFile, templatesJson);
			vscode.window.showInformationMessage('✅ Templates saved successfully!');
			this.sendTemplates();
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save templates: ${error}`);
		}
	}

	private async openTemplatesFile() {
		const uri = vscode.Uri.file(templatesFile);
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
		const content = fs.readFileSync(templatesFile, 'utf8');
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
		fs.writeFileSync(templatesFile, JSON.stringify(templates, null, 2));
		vscode.window.showInformationMessage(
			`✅ Template "${name}" added to "${category}"!`
		);
		this.sendTemplates();
	}

	public revive(panel: vscode.WebviewView) {
		this._view = panel;
	}
}
