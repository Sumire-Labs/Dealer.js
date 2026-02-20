import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';

export function createContainer(accentColor: number): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(accentColor);
}

export function createHeader(text: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(text);
}

export function createText(text: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(text);
}

export function createDivider(
  spacing: SeparatorSpacingSize = SeparatorSpacingSize.Small,
): SeparatorBuilder {
  return new SeparatorBuilder().setDivider(true).setSpacing(spacing);
}

export function buildGameContainer(
  accentColor: number,
  header: string,
  bodyLines: string[],
): ContainerBuilder {
  const container = createContainer(accentColor)
    .addTextDisplayComponents(createHeader(header))
    .addSeparatorComponents(createDivider());

  for (const line of bodyLines) {
    container.addTextDisplayComponents(createText(line));
  }

  return container;
}
