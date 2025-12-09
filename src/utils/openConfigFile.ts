import { config } from '@/config';
import vscode from 'vscode';

export async function openConfigFile() {
	const uri = vscode.Uri.file(config.templatesFile);
	const document = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(document);
	vscode.window.showInformationMessage(
		'💡 Edit your templates here! Save and run "Reload Templates" to apply changes.'
	);
}
