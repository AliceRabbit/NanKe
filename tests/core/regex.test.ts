import { describe, expect, it } from 'vitest';
import { applyRegexScripts, hasRegexScriptForPlacement, REGEX_PLACEMENT } from '$lib/core/regex';
import type { RegexScript } from '$lib/schemas/regex';

function script(input: Partial<RegexScript>): RegexScript {
  return {
    id: 'script',
    scriptName: 'Script',
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [],
    disabled: false,
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    ...input
  };
}

describe('RegexEngine', () => {
  it('applies SillyTavern-style regex literals and capture replacements', () => {
    const output = applyRegexScripts(
      'status: <tag>ready</tag>',
      [
        script({
          findRegex: '/<tag>(.*?)<\\/tag>/g',
          replaceString: '[$1]',
          placement: [REGEX_PLACEMENT.AI_OUTPUT]
        })
      ],
      { placement: REGEX_PLACEMENT.AI_OUTPUT }
    );

    expect(output).toBe('status: [ready]');
  });

  it('separates prompt-only scripts from display/normal scripts', () => {
    const scripts = [
      script({
        findRegex: '/secret/g',
        replaceString: '',
        placement: [REGEX_PLACEMENT.AI_OUTPUT],
        promptOnly: true
      })
    ];

    expect(applyRegexScripts('secret', scripts, { placement: REGEX_PLACEMENT.AI_OUTPUT })).toBe('secret');
    expect(applyRegexScripts('secret', scripts, { placement: REGEX_PLACEMENT.AI_OUTPUT, isPrompt: true })).toBe('');
    expect(hasRegexScriptForPlacement(scripts, { placement: REGEX_PLACEMENT.AI_OUTPUT, isPrompt: true })).toBe(true);
  });

  it('honors depth gates and macro substitution in find regex', () => {
    const scripts = [
      script({
        findRegex: '/{{char}} says: (.*)/g',
        replaceString: '$1',
        placement: [REGEX_PLACEMENT.AI_OUTPUT],
        promptOnly: true,
        substituteRegex: 2,
        minDepth: 2
      })
    ];

    expect(applyRegexScripts('A+B says: hello', scripts, { placement: REGEX_PLACEMENT.AI_OUTPUT, isPrompt: true, depth: 1, macros: { char: 'A+B' } })).toBe(
      'A+B says: hello'
    );
    expect(applyRegexScripts('A+B says: hello', scripts, { placement: REGEX_PLACEMENT.AI_OUTPUT, isPrompt: true, depth: 2, macros: { char: 'A+B' } })).toBe(
      'hello'
    );
  });
});
