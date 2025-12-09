import type { TTemplates } from '@/types';
import vscode from 'vscode';
import fs from 'fs';
import { config } from '@/config';

export async function loadTemplates(): Promise<TTemplates> {
	try {
		const content = fs.readFileSync(config.templatesFile, 'utf8');
		return JSON.parse(content);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to load templates: ${error}`);
		return {};
	}
}
