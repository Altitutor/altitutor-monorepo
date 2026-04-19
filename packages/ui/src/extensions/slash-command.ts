import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import type { SuggestionOptions } from '@tiptap/suggestion';

export const SLASH_COMMAND_PLUGIN_KEY = new PluginKey('slashCommand');

export interface SlashCommandOptions {
  /**
   * Suggestion options for the slash command menu.
   * Omit 'editor' and 'char' - they are set by the extension.
   */
  suggestion: Omit<SuggestionOptions<unknown, unknown>, 'editor' | 'char'>;
}

/**
 * Extension that adds a slash command menu triggered by typing "/".
 * Uses @tiptap/suggestion under the hood.
 * Configure with items, command, and render (e.g. for a React dropdown).
 */
export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {},
    };
  },

  addProseMirrorPlugins() {
    const { suggestion } = this.options;

    return [
      Suggestion({
        ...suggestion,
        editor: this.editor,
        char: '/',
        pluginKey: SLASH_COMMAND_PLUGIN_KEY,
        allowSpaces: true,
      }),
    ];
  },
});
