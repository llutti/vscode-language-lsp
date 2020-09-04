import { CancellationToken, Hover, HoverProvider, Position, ProviderResult, TextDocument } from 'vscode';
import autoCompleteList from '../autocomplete';

export class LSPHoverProvider implements HoverProvider
{
	public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover>
	{
		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		if (word !== '')
		{
			const token = autoCompleteList.find(x => x.label.toUpperCase() === word.toUpperCase());

			const hover = token?.getHoverContens();
			if (hover)
			{
				hover.range = range;
				return hover;
			}
		}
	}
}