import vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execAsync, loadTemplates, openConfigFile } from '@/utils';

export async function createProjectFromTemplate(
	context: vscode.ExtensionContext
) {
	// Load templates from user's home directory
	const templates = await loadTemplates();

	if (!Object.keys(templates).length) {
		const openFile = await vscode.window.showWarningMessage(
			'No templates found. Would you like to open the templates file?',
			'Open Templates File'
		);
		if (openFile) {
			await openConfigFile();
		}
		return;
	}

	// Step 1: Select category
	const categories = Object.keys(templates);
	const selectedCategory = await vscode.window.showQuickPick(categories, {
		placeHolder: '🚀 Select a project category',
		title: 'Project Template Manager - Step 1/4',
	});

	if (!selectedCategory) return;

	// Step 2: Select template
	const templateNames = Object.keys(templates[selectedCategory]);
	const templateItems = templateNames.map((name) => {
		const template = templates[selectedCategory][name];
		return {
			label: `$(package) ${name}`,
			description: template.description,
			detail: `👥 ${template.authors.map((a) => a.name).join(', ')} | 🌐 ${
				template.homepage
			}`,
			value: name,
		};
	});

	const selectedTemplateItem = await vscode.window.showQuickPick(
		templateItems,
		{
			placeHolder: '📦 Choose your project template',
			title: 'Project Template Manager - Step 2/4',
			matchOnDescription: true,
			matchOnDetail: true,
		}
	);

	if (!selectedTemplateItem) return;

	const template = templates[selectedCategory][selectedTemplateItem.value];

	// Step 3: Get project name
	const projectName = await vscode.window.showInputBox({
		prompt: '📝 Enter your project name',
		placeHolder: 'my-awesome-project',
		title: 'Project Template Manager - Step 3/4',
		validateInput: (value) => {
			if (!value || value.trim() === '') {
				return 'Project name cannot be empty';
			}
			if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
				return 'Project name can only contain letters, numbers, hyphens, and underscores';
			}
			return null;
		},
	});

	if (!projectName) return;

	// Step 4: Get project path
	const config = vscode.workspace.getConfiguration('projectTemplateManager');
	const defaultPath = config.get<string>('defaultPath') || os.homedir();

	const useDefault = await vscode.window.showQuickPick(
		[
			{
				label: '$(folder) Use Default Location',
				value: 'default',
				description: defaultPath,
			},
			{ label: '$(search) Browse for Location', value: 'browse' },
		],
		{
			placeHolder: '📁 Choose project location',
			title: 'Project Template Manager - Step 4/4',
		}
	);

	if (!useDefault) return;

	let projectPath: string;

	if (useDefault.value === 'browse') {
		const folderUri = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: '📁 Select Project Location',
			defaultUri: vscode.Uri.file(defaultPath),
		});

		if (!folderUri || folderUri.length === 0) return;
		projectPath = folderUri[0].fsPath;
	} else {
		projectPath = defaultPath;
	}

	const fullProjectPath = path.join(projectPath, projectName);

	// Check if project already exists
	if (fs.existsSync(fullProjectPath)) {
		const overwrite = await vscode.window.showWarningMessage(
			`Project "${projectName}" already exists. Do you want to overwrite it?`,
			'Yes',
			'No'
		);
		if (overwrite !== 'Yes') return;
		fs.rmSync(fullProjectPath, { recursive: true, force: true });
	}

	// Create project
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Creating ${projectName}`,
			cancellable: false,
		},
		async (progress) => {
			try {
				// Clone repository
				progress.report({ increment: 0, message: '📥 Cloning repository...' });
				await execAsync(
					`git clone ${template['git-repository']} "${projectName}"`,
					{
						cwd: projectPath,
					}
				);

				// Delete .git folder
				progress.report({
					increment: 40,
					message: '🗑️ Cleaning up git history...',
				});
				const gitPath = path.join(fullProjectPath, '.git');
				if (fs.existsSync(gitPath)) {
					fs.rmSync(gitPath, { recursive: true, force: true });
				}

				// Run post-install
				progress.report({
					increment: 60,
					message: '📦 Installing dependencies...',
				});
				await execAsync(template['post-install'], {
					cwd: fullProjectPath,
				});

				progress.report({
					increment: 100,
					message: '✅ Project created successfully!',
				});

				// Show success message
				const openProject = await vscode.window.showInformationMessage(
					`🎉 Project "${projectName}" created successfully!`,
					'Open Project',
					'Open in New Window'
				);

				if (openProject === 'Open Project') {
					await vscode.commands.executeCommand(
						'vscode.openFolder',
						vscode.Uri.file(fullProjectPath),
						false
					);
				} else if (openProject === 'Open in New Window') {
					await vscode.commands.executeCommand(
						'vscode.openFolder',
						vscode.Uri.file(fullProjectPath),
						true
					);
				}
			} catch (error: any) {
				throw new Error(`Failed to create project: ${error.message}`);
			}
		}
	);
}
