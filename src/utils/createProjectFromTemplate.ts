import vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { loadTemplates, openConfigFile } from '@/utils';

// Create output channel
let outputChannel: vscode.OutputChannel;

function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel(
			'Project Template Manager'
		);
	}
	return outputChannel;
}

function log(message: string, show: boolean = false) {
	const channel = getOutputChannel();
	const timestamp = new Date().toLocaleTimeString();
	channel.appendLine(`[${timestamp}] ${message}`);
	if (show) {
		channel.show(true); // true = preserve focus
	}
}

function logError(message: string) {
	const channel = getOutputChannel();
	const timestamp = new Date().toLocaleTimeString();
	channel.appendLine(`[${timestamp}] ❌ ERROR: ${message}`);
	channel.show(true);
}

// Execute command with real-time streaming output
function execStreamAsync(
	command: string,
	options: { cwd: string }
): Promise<void> {
	return new Promise((resolve, reject) => {
		const isWindows = process.platform === 'win32';
		const shell = isWindows ? 'cmd.exe' : '/bin/sh';
		const shellArgs = isWindows ? ['/c', command] : ['-c', command];

		// Force unbuffered output for npm/yarn
		const env = {
			...process.env,
			// Disable npm progress bar and use streaming output
			NPM_CONFIG_PROGRESS: 'false',
			NPM_CONFIG_LOGLEVEL: 'verbose',
			// Force line-buffered output
			PYTHONUNBUFFERED: '1',
			// Disable buffering
			NODE_NO_WARNINGS: '1',
		};

		const child = spawn(shell, shellArgs, {
			cwd: options.cwd,
			env: env,
			// Force unbuffered I/O
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		// Buffer to handle partial lines
		let stdoutBuffer = '';
		let stderrBuffer = '';

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');

		child.stdout.on('data', (data) => {
			stdoutBuffer += data;
			const lines = stdoutBuffer.split('\n');
			// Keep the last incomplete line in buffer
			stdoutBuffer = lines.pop() || '';

			lines.forEach((line: string) => {
				if (line.trim()) {
					log(`  ${line.trim()}`);
				}
			});
		});

		child.stderr.on('data', (data) => {
			stderrBuffer += data;
			const lines = stderrBuffer.split('\n');
			// Keep the last incomplete line in buffer
			stderrBuffer = lines.pop() || '';

			lines.forEach((line: string) => {
				if (line.trim()) {
					log(`  ${line.trim()}`);
				}
			});
		});

		child.on('error', (error) => {
			reject(error);
		});

		child.on('close', (code) => {
			// Flush remaining buffer content
			if (stdoutBuffer.trim()) {
				log(`  ${stdoutBuffer.trim()}`);
			}
			if (stderrBuffer.trim()) {
				log(`  ${stderrBuffer.trim()}`);
			}

			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Command exited with code ${code}`));
			}
		});
	});
}

export async function createProjectFromTemplate(
	context: vscode.ExtensionContext
) {
	// Clear and show output channel
	const channel = getOutputChannel();
	channel.clear();
	channel.show(true);

	log('🚀 Starting Project Template Manager...', true);

	// Load templates from user's home directory
	log('📂 Loading templates from user directory...');
	const templates = await loadTemplates();
	log(`✓ Found ${Object.keys(templates).length} template categories`);

	if (!Object.keys(templates).length) {
		logError('No templates found');
		const openFile = await vscode.window.showWarningMessage(
			'No templates found. Would you like to open the templates file?',
			'Open Templates File'
		);
		if (openFile) {
			log('Opening templates configuration file...');
			await openConfigFile();
		}
		return;
	}

	// Step 1: Select category
	log('📋 Step 1/4: Selecting category...');
	const categories = Object.keys(templates);
	log(`Available categories: ${categories.join(', ')}`);

	const selectedCategory = await vscode.window.showQuickPick(categories, {
		placeHolder: '🚀 Select a project category',
		title: 'Project Template Manager - Step 1/4',
	});

	if (!selectedCategory) {
		log('⚠️ Category selection cancelled by user');
		return;
	}
	log(`✓ Selected category: ${selectedCategory}`);

	// Step 2: Select template
	log('📦 Step 2/4: Selecting template...');
	const templateNames = Object.keys(templates[selectedCategory]);
	log(
		`Available templates in ${selectedCategory}: ${templateNames.join(', ')}`
	);

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

	if (!selectedTemplateItem) {
		log('⚠️ Template selection cancelled by user');
		return;
	}

	const template = templates[selectedCategory][selectedTemplateItem.value];
	log(`✓ Selected template: ${selectedTemplateItem.value}`);
	log(`  Description: ${template.description}`);
	log(`  Repository: ${template['git-repository']}`);
	log(`  Authors: ${template.authors.map((a) => a.name).join(', ')}`);

	// Step 3: Get project name
	log('✏️ Step 3/4: Getting project name...');
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

	if (!projectName) {
		log('⚠️ Project name input cancelled by user');
		return;
	}
	log(`✓ Project name: ${projectName}`);

	// Step 4: Get project path
	log('📁 Step 4/4: Selecting project location...');
	const config = vscode.workspace.getConfiguration('projectTemplateManager');
	const defaultPath = config.get<string>('defaultPath') || os.homedir();
	log(`Default path: ${defaultPath}`);

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

	if (!useDefault) {
		log('⚠️ Location selection cancelled by user');
		return;
	}

	let projectPath: string;

	if (useDefault.value === 'browse') {
		log('Opening folder browser...');
		const folderUri = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: '📁 Select Project Location',
			defaultUri: vscode.Uri.file(defaultPath),
		});

		if (!folderUri || folderUri.length === 0) {
			log('⚠️ Folder browsing cancelled by user');
			return;
		}
		projectPath = folderUri[0].fsPath;
		log(`✓ Selected custom path: ${projectPath}`);
	} else {
		projectPath = defaultPath;
		log(`✓ Using default path: ${projectPath}`);
	}

	const fullProjectPath = path.join(projectPath, projectName);
	log(`Full project path: ${fullProjectPath}`);

	// Check if project already exists
	if (fs.existsSync(fullProjectPath)) {
		log(`⚠️ Project directory already exists: ${fullProjectPath}`);
		const overwrite = await vscode.window.showWarningMessage(
			`Project "${projectName}" already exists. Do you want to overwrite it?`,
			'Yes',
			'No'
		);
		if (overwrite !== 'Yes') {
			log('User chose not to overwrite existing project');
			return;
		}
		log('Removing existing project directory...');
		fs.rmSync(fullProjectPath, { recursive: true, force: true });
		log('✓ Existing project removed');
	}

	// Create project
	log('');
	log('═══════════════════════════════════════════════════════════');
	log('🚀 STARTING PROJECT CREATION');
	log('═══════════════════════════════════════════════════════════');
	log('');

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Creating ${projectName}`,
			cancellable: true,
		},
		async (progress) => {
			try {
				// Clone repository
				progress.report({ increment: 0, message: '📥 Cloning repository...' });
				log('📥 Cloning repository...');
				log(`Command: git clone ${template['git-repository']} ${projectName}`);
				log(`Working directory: ${projectPath}`);
				log('');

				await execStreamAsync(
					`git clone ${template['git-repository']} ${projectName}`,
					{
						cwd: projectPath,
					}
				);

				log('');
				log('✓ Repository cloned successfully');

				// Delete .git folder
				progress.report({
					increment: 40,
					message: '🗑️ Cleaning up git history...',
				});
				log('');
				log('🗑️ Cleaning up git history...');
				const gitPath = path.join(fullProjectPath, '.git');
				if (fs.existsSync(gitPath)) {
					log(`Removing: ${gitPath}`);
					fs.rmSync(gitPath, { recursive: true, force: true });
					log('✓ Git history removed');
				} else {
					log('⚠️ No .git folder found to remove');
				}

				// Run post-install
				progress.report({
					increment: 60,
					message: '📦 Installing dependencies...',
				});
				log('');
				log('📦 Running post-install commands...');

				try {
					if (template['post-install']) {
						log(`Command: ${template['post-install']}`);
						log(`Working directory: ${fullProjectPath}`);
						log('');
						log('Post-install output:');
						log('─────────────────────────────────────────────────────────');

						await execStreamAsync(template['post-install'], {
							cwd: fullProjectPath,
						});

						log('─────────────────────────────────────────────────────────');
						log('✓ Post-install completed successfully');
					} else {
						log('⚠️ No post-install command specified');
					}
				} catch (installError: any) {
					logError(`Post-install failed: ${installError.message}`);
					log('⚠️ Continuing despite post-install failure...');
				}

				progress.report({
					increment: 100,
					message: '✅ Project created successfully!',
				});

				log('');
				log('═══════════════════════════════════════════════════════════');
				log('✅ PROJECT CREATED SUCCESSFULLY!');
				log('═══════════════════════════════════════════════════════════');
				log(`Project name: ${projectName}`);
				log(`Location: ${fullProjectPath}`);
				log(`Template: ${selectedTemplateItem.value}`);
				log('');

				// Show success message
				const openProject = await vscode.window.showInformationMessage(
					`🎉 Project "${projectName}" created successfully!`,
					'Open Project',
					'Open in New Window'
				);

				if (openProject === 'Open Project') {
					log('Opening project in current window...');
					await vscode.commands.executeCommand(
						'vscode.openFolder',
						vscode.Uri.file(fullProjectPath),
						false
					);
				} else if (openProject === 'Open in New Window') {
					log('Opening project in new window...');
					await vscode.commands.executeCommand(
						'vscode.openFolder',
						vscode.Uri.file(fullProjectPath),
						true
					);
				}
			} catch (error: any) {
				logError(`Failed to create project: ${error.message}`);
				if (error.stack) {
					log('Stack trace:');
					error.stack.split('\n').forEach((line: string) => {
						log(`  ${line}`);
					});
				}
				throw new Error(`Failed to create project: ${error.message}`);
			}
		}
	);
}
