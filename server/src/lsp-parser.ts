import { LSPClass } from './lsp-elements';

export class LSPParser
{
	private static wipClass: LSPClass;
	private static isReady: PromiseLike<any> = Promise.resolve();

	public static initialise(): PromiseLike<any>
	{
		return this.isReady;
	}  // Placeholder in case we need to initialise onigasm here

	public static parseFile(fileUri: string, fileContent: string, deep: boolean = false, isIntrinsic: boolean = false): LSPClass
	{
		this.wipClass = new LSPClass('teste');

		return this.wipClass;
	}

}
