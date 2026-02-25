import {TextDisplayBuilder} from 'discord.js';

export function gameHeader(prefix: string): TextDisplayBuilder {
    return new TextDisplayBuilder().setContent(prefix);
}
