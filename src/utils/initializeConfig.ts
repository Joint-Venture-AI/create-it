import vscode from 'vscode';
import fs from 'fs';
import { config } from '@/config';
import { openConfigFile } from '@/utils';

export async function initializeConfig(context: vscode.ExtensionContext) {
	// Create .create-it directory if it doesn't exist
	if (!fs.existsSync(config.configDir)) {
		fs.mkdirSync(config.configDir, { recursive: true });
		vscode.window.showInformationMessage(
			`✅ Created config directory at: ${config.configDir}`
		);
	}

	// Create templates.json if it doesn't exist
	if (!fs.existsSync(config.templatesFile)) {
		const defaultTemplates = await fetch(config.defaultTemplateUrl).then(
			(res) => res.json()
		);

		fs.writeFileSync(
			config.templatesFile,
			JSON.stringify(defaultTemplates, null, 2)
		);

		const selection = await vscode.window.showInformationMessage(
			`✅ Created templates file at: ${config.templatesFile}`,
			'Open Templates File'
		);

		if (selection === 'Open Templates File') {
			await openConfigFile();
		}
	}
}
