export const toNumberOrDefault = (str: string, defaultValue: number): number => {
	return str === undefined ? defaultValue : +str;
};
