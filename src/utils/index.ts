import { exec } from 'child_process';
import { promisify } from 'util';

export * from './createProjectFromTemplate';
export * from './initializeConfig';
export * from './openConfigFile';
export * from './loadTemplates';

export const execAsync = promisify(exec);
