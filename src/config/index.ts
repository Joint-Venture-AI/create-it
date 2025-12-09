import path from 'path';
import os from 'os';

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.create-it');
const templatesFile = path.join(configDir, 'templates.json');
const defaultTemplateUrl =
	'https://github.com/Joint-Venture-AI/create-it/blob/main/resources/teamplates.json?raw=true';
const sidebarUrl =
	'https://raw.githubusercontent.com/Joint-Venture-AI/create-it/main/resources/sidebar.html';

export const config = {
	homeDir,
	configDir,
	templatesFile,
	defaultTemplateUrl,
	sidebarUrl,
};
