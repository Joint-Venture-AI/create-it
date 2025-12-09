import vscode from 'vscode';
import { SidebarProvider } from '@/SidebarProvider';
import {
	createProjectFromTemplate,
	initializeConfig,
	openConfigFile,
} from '@/utils';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Project Template Manager is now active!');

	// Initialize config directory and templates file
	await initializeConfig(context);

	// Register sidebar provider
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'create-it-sidebar',
			sidebarProvider
		)
	);

	const createProjectDisposable = vscode.commands.registerCommand(
		'create-it.createProject',
		async () => {
			try {
				await createProjectFromTemplate(context);
			} catch (error) {
				vscode.window.showErrorMessage(`Error: ${error}`);
			}
		}
	);

	const openConfigDisposable = vscode.commands.registerCommand(
		'create-it.openConfig',
		async () => {
			await openConfigFile();
		}
	);

	const reloadTemplatesDisposable = vscode.commands.registerCommand(
		'create-it.reloadTemplates',
		async () => {
			vscode.window.showInformationMessage(
				'Templates reloaded successfully! 🔄'
			);
		}
	);

	context.subscriptions.push(
		createProjectDisposable,
		openConfigDisposable,
		reloadTemplatesDisposable
	);
}

export function deactivate() {}
