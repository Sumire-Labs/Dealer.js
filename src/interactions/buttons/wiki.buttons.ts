import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {buildHelpTopView} from '../../ui/builders/help.builder.js';
import {buildWikiCategoryView, buildWikiItemDetailView, buildWikiTopView,} from '../../ui/builders/wiki.builder.js';

// State per user: current category + page
export const wikiState = new Map<string, { category: string; page: number }>();

async function handleWikiButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // wiki:action:userId[:extra]
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのパネルではありません！ `/help` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  let view;

  switch (action) {
    case 'back_help': {
      view = buildHelpTopView(userId);
      break;
    }
    case 'back_top': {
      view = buildWikiTopView(userId);
      break;
    }
    case 'back_cat': {
      const catKey = parts[3] ?? '';
      const state = getState(userId, catKey);
      view = buildWikiCategoryView(userId, state.category, state.page);
      break;
    }
    case 'prev': {
      const state = getState(userId);
      state.page = Math.max(0, state.page - 1);
      view = buildWikiCategoryView(userId, state.category, state.page);
      break;
    }
    case 'next': {
      const state = getState(userId);
      state.page += 1;
      view = buildWikiCategoryView(userId, state.category, state.page);
      break;
    }
    case 'item': {
      const itemId = parts[3] ?? '';
      const state = getState(userId);
      view = buildWikiItemDetailView(userId, itemId, state.category);
      break;
    }
    default: {
      view = buildWikiTopView(userId);
      break;
    }
  }

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

function getState(userId: string, categoryOverride?: string) {
  if (!wikiState.has(userId)) {
    if (wikiState.size > 10_000) wikiState.clear();
    wikiState.set(userId, { category: categoryOverride ?? 'consumable', page: 0 });
  }
  const state = wikiState.get(userId)!;
  if (categoryOverride) {
    state.category = categoryOverride;
  }
  return state;
}

registerButtonHandler('wiki', handleWikiButton as never);
