export type TAuthor = {
	name: string;
	url: string;
};

export type TTemplate = {
	description: string;
	homepage: string;
	authors: TAuthor[];
	'git-repository': string;
	'post-install': string;
};

export type TTemplates = {
	[category: string]: {
		[templateName: string]: TTemplate;
	};
};
