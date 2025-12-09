import path from 'path';
import os from 'os';

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.create-it');
const templatesFile = path.join(configDir, 'templates.json');
const defaultTemplateUrl =
	'https://github.com/Joint-Venture-AI/create-it/blob/main/resources/teamplates.json?raw=true';

export const config = {
	homeDir,
	configDir,
	templatesFile,
	defaultTemplateUrl,
};
