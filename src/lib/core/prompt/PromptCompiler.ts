import type { Character } from '$lib/schemas/character';
import { createMessage, type NankeMessage } from '$lib/schemas/message';
import type { GenerationProfile, PromptSlot } from '$lib/schemas/profile';
import type { ActivatedWorldEntry } from '$lib/core/worldbook/WorldBookActivation';
import { applyRegexScripts, REGEX_PLACEMENT } from '$lib/core/regex';
import { trimMessagesToBudget } from './TokenBudgeter';
import type { CompiledPrompt, PromptWarning } from './PromptGraph';

export type PromptCompilerInput = {
  profile: GenerationProfile;
  character?: Character;
  messages: NankeMessage[];
  activatedWorldEntries?: ActivatedWorldEntry[];
  persona?: string;
  userName?: string;
};

type MacroState = {
  variables: Map<string, string>;
  unsupported: Set<string>;
  values: Map<string, string>;
  lastUserMessage: string;
  lastCharMessage: string;
  lastMessage: string;
  input: PromptCompilerInput;
};

type MacroInfo = {
  name: string;
  args: string[];
  flags: Set<string>;
  isClosing: boolean;
};

function lastUserMessage(messages: NankeMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user') return message.content;
  }
  return '';
}

function formatRuntimeValue(format: string | undefined, value: string): string {
  if (!value) return '';
  if (!format?.trim()) return value;
  if (format.includes('{0}')) return format.replaceAll('{0}', value);
  if (format.includes('{{content}}')) return format.replaceAll('{{content}}', value);
  return format;
}

function lastCharMessage(messages: NankeMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') return message.content;
  }
  return '';
}

function buildMacroValues(input: PromptCompilerInput): Map<string, string> {
  const character = input.character;
  const charName = character?.name ?? 'Assistant';
  const userName = input.userName ?? 'User';
  const contextTokens = input.profile.sampler.contextTokens ?? 0;
  const maxTokens = input.profile.sampler.maxTokens ?? 0;
  return new Map(
    Object.entries({
      char: charName,
      bot: charName,
      charifnotgroup: charName,
      group: charName,
      groupnotmuted: charName,
      notchar: userName,
      user: userName,
      description: character?.description ?? '',
      chardescription: character?.description ?? '',
      personality: character?.personality ?? '',
      charpersonality: character?.personality ?? '',
      scenario: character?.scenario ?? '',
      charscenario: character?.scenario ?? '',
      persona: input.persona ?? '',
      charprompt: character?.systemPrompt ?? '',
      systemprompt: character?.systemPrompt ?? '',
      defaultsystemprompt: character?.systemPrompt ?? '',
      charinstruction: character?.postHistoryInstructions ?? '',
      chardepthprompt: character?.depthPrompt?.prompt ?? '',
      charcreatornotes: character?.creatorNotes ?? '',
      creatornotes: character?.creatorNotes ?? '',
      charversion: character?.characterVersion ?? '',
      version: character?.characterVersion ?? '',
      char_version: character?.characterVersion ?? '',
      mesexamples: character?.exampleMessages ?? '',
      mesexamplesraw: character?.exampleMessages ?? '',
      original: '',
      model: input.profile.provider.model,
      ismobile: 'false',
      maxcontexttokens: String(contextTokens || ''),
      maxresponsetokens: String(maxTokens || ''),
      maxprompt: String(Math.max(0, contextTokens - maxTokens) || ''),
      input: lastUserMessage(input.messages),
      summary: '',
      lastgenerationtype: ''
    })
  );
}

function createMacroState(input: PromptCompilerInput): MacroState {
  const lastMessage = input.messages.at(-1)?.content ?? '';
  return {
    variables: new Map(),
    unsupported: new Set(),
    values: buildMacroValues(input),
    lastUserMessage: lastUserMessage(input.messages),
    lastCharMessage: lastCharMessage(input.messages),
    lastMessage,
    input
  };
}

function topLevelSplit(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith('{{', index)) {
      depth += 1;
      index += 1;
      continue;
    }
    if (value.startsWith('}}', index)) {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }
    if (depth === 0 && value.startsWith(separator, index)) {
      parts.push(value.slice(start, index).trim());
      start = index + separator.length;
      index += separator.length - 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function parseMacro(expression: string): MacroInfo | undefined {
  const raw = expression.trim();
  if (!raw || raw.startsWith('//')) return { name: '//', args: [], flags: new Set(), isClosing: false };

  const flags = new Set<string>();
  let index = 0;
  while (raw[index] && '/#!?~>'.includes(raw[index])) {
    flags.add(raw[index]);
    index += 1;
  }
  const body = raw.slice(index).trim();
  const isClosing = flags.has('/');
  const nameMatch = body.match(/^([A-Za-z][\w-]*|[.$][A-Za-z][\w-]*)/);
  if (!nameMatch) return undefined;

  const name = nameMatch[1].toLowerCase();
  const rest = body.slice(nameMatch[0].length).trim();
  let args: string[] = [];
  if (rest.startsWith('::')) args = topLevelSplit(rest.slice(2), '::');
  else if (rest.startsWith(':')) args = [rest.slice(1).trim()];
  else if (rest) args = [rest];
  return { name, args, flags, isClosing };
}

function findMacroClose(template: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex + 2; index < template.length - 1; index += 1) {
    if (template[index - 1] === '\\') continue;
    if (template.startsWith('{{', index)) {
      depth += 1;
      index += 1;
      continue;
    }
    if (template.startsWith('}}', index)) {
      if (depth === 0) return index;
      depth -= 1;
      index += 1;
    }
  }
  return -1;
}

function findScopedClose(template: string, start: number, name: string): { open: number; close: number } | undefined {
  let depth = 0;
  for (let index = start; index < template.length - 1; index += 1) {
    if (template[index - 1] === '\\' || !template.startsWith('{{', index)) continue;
    const close = findMacroClose(template, index);
    if (close < 0) return undefined;
    const info = parseMacro(template.slice(index + 2, close));
    if (info?.name === name && info.isClosing) {
      if (depth === 0) return { open: index, close };
      depth -= 1;
    } else if (info?.name === name && !info.isClosing && info.args.length <= 1) {
      depth += 1;
    }
    index = close + 1;
  }
  return undefined;
}

function splitIfBranches(content: string): { thenBranch: string; elseBranch?: string } {
  let depth = 0;
  for (let index = 0; index < content.length - 1; index += 1) {
    if (content[index - 1] === '\\' || !content.startsWith('{{', index)) continue;
    const close = findMacroClose(content, index);
    if (close < 0) break;
    const info = parseMacro(content.slice(index + 2, close));
    if (info?.name === 'if' && info.isClosing) depth = Math.max(0, depth - 1);
    else if (info?.name === 'if') depth += 1;
    else if (info?.name === 'else' && depth === 0) {
      return { thenBranch: content.slice(0, index), elseBranch: content.slice(close + 2) };
    }
    index = close + 1;
  }
  return { thenBranch: content };
}

function trimScopedContent(content: string): string {
  const trimmed = content.replace(/^\n/, '').replace(/\n\s*$/, '');
  const indents = trimmed
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const minIndent = indents.length ? Math.min(...indents) : 0;
  return minIndent > 0 ? trimmed.replace(new RegExp(`^\\s{0,${minIndent}}`, 'gm'), '') : trimmed;
}

function isFalsyMacroValue(value: string): boolean {
  return value === '' || /^(false|off|no|0)$/i.test(value.trim());
}

function choiceArgs(args: string[]): string[] {
  const values = args.length === 1 && args[0].includes(',') ? args[0].split(',') : args;
  return values.map((value) => value.trim()).filter(Boolean);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rollDice(expression: string): string {
  const match = expression.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return '';
  const count = Math.max(1, Math.min(Number(match[1] || 1), 1000));
  const sides = Math.max(1, Number(match[2]));
  const modifier = Number(match[3] ?? 0);
  let total = modifier;
  for (let roll = 0; roll < count; roll += 1) total += Math.floor(Math.random() * sides) + 1;
  return String(total);
}

function formatDateToken(format: string, date = new Date()): string {
  const parts: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
    ss: String(date.getSeconds()).padStart(2, '0')
  };
  return Object.entries(parts).reduce((result, [token, value]) => result.replaceAll(token, value), format);
}

function addVariable(previous: string, value: string): string {
  const left = Number(previous);
  const right = Number(value);
  return Number.isFinite(left) && Number.isFinite(right) ? String(left + right) : previous + value;
}

function renderVariableShorthand(key: string, rest: string, state: MacroState, resolve: (value: string) => string): string {
  const current = state.variables.get(key);
  const raw = rest.trim();
  if (!raw) return current ?? '';

  const operator = ['??=', '||=', '+=', '-=', '==', '!=', '>=', '<=', '++', '--', '=', '||', '??', '>', '<'].find((item) => raw.startsWith(item));
  if (!operator) return current ?? '';

  const value = resolve(raw.slice(operator.length).trim());
  if (operator === '=') {
    state.variables.set(key, value);
    return '';
  }
  if (operator === '++' || operator === '--') {
    const next = Number(current ?? 0) + (operator === '++' ? 1 : -1);
    state.variables.set(key, String(next));
    return String(next);
  }
  if (operator === '+=') {
    state.variables.set(key, addVariable(current ?? '', value));
    return '';
  }
  if (operator === '-=') {
    state.variables.set(key, String(Number(current ?? 0) - Number(value)));
    return '';
  }
  if (operator === '||') return current && !isFalsyMacroValue(current) ? current : value;
  if (operator === '??') return current ?? value;
  if (operator === '||=') {
    if (!current || isFalsyMacroValue(current)) state.variables.set(key, value);
    return state.variables.get(key) ?? '';
  }
  if (operator === '??=') {
    if (current === undefined) state.variables.set(key, value);
    return state.variables.get(key) ?? '';
  }
  if (operator === '==') return String((current ?? '') === value);
  if (operator === '!=') return String((current ?? '') !== value);

  const left = Number(current ?? 0);
  const right = Number(value);
  if (operator === '>') return String(left > right);
  if (operator === '<') return String(left < right);
  if (operator === '>=') return String(left >= right);
  if (operator === '<=') return String(left <= right);
  return current ?? '';
}

function renderMacro(info: MacroInfo, rawExpression: string, state: MacroState, depth: number, scopedContent?: string): string {
  if (info.name === '//') return '';
  if (info.isClosing) return '';

  const resolve = (value: string) => renderSillyTavernTemplate(value, state, depth + 1);
  const args = info.args;
  const resolvedArgs = () => args.map(resolve);
  const name = info.name;

  if (name.startsWith('.')) {
    return renderVariableShorthand(name.slice(1), args[0] ?? '', state, resolve);
  }
  if (name.startsWith('$')) {
    return renderVariableShorthand(name.slice(1), args[0] ?? '', state, resolve);
  }

  if (state.values.has(name)) return state.values.get(name) ?? '';
  if (name === 'lastusermessage') return state.lastUserMessage;
  if (name === 'lastcharmessage') return state.lastCharMessage;
  if (name === 'lastmessage' || name === 'lastchatmessage') return state.lastMessage;
  if (name === 'lastmessageid') return String(Math.max(0, state.input.messages.length - 1));
  if (name === 'firstincludedmessageid' || name === 'firstdisplayedmessageid') return '0';
  if (name === 'lastswipeid' || name === 'currentswipeid') return '1';
  if (name === 'allchatrange') return `0-${Math.max(0, state.input.messages.length - 1)}`;

  const variableMacro = name.replace('globalvar', 'var');
  if (variableMacro === 'setvar') {
    const [key = '', value = scopedContent ?? ''] = args;
    const renderedKey = resolve(key).trim();
    if (renderedKey) state.variables.set(renderedKey, resolve(value));
    return '';
  }
  if (variableMacro === 'getvar') return state.variables.get(resolve(args[0] ?? '').trim()) ?? '';
  if (variableMacro === 'addvar') {
    const [key = '', value = ''] = resolvedArgs();
    const previous = state.variables.get(key.trim()) ?? '';
    state.variables.set(key.trim(), addVariable(previous, value));
    return '';
  }
  if (variableMacro === 'incvar' || variableMacro === 'decvar') {
    const key = resolve(args[0] ?? '').trim();
    const next = Number(state.variables.get(key) ?? 0) + (variableMacro === 'incvar' ? 1 : -1);
    state.variables.set(key, String(next));
    return String(next);
  }
  if (variableMacro === 'hasvar') return String(state.variables.has(resolve(args[0] ?? '').trim()));
  if (variableMacro === 'deletevar') {
    state.variables.delete(resolve(args[0] ?? '').trim());
    return '';
  }

  if (name === 'if') {
    let condition = args[0] ?? '';
    let inverted = false;
    if (/^\s*!/.test(condition)) {
      inverted = true;
      condition = condition.replace(/^\s*!\s*/, '');
    }
    const conditionValue = resolve(condition);
    const showThen = inverted ? isFalsyMacroValue(conditionValue) : !isFalsyMacroValue(conditionValue);
    const branches = splitIfBranches(scopedContent ?? args[1] ?? '');
    const chosen = showThen ? branches.thenBranch : (branches.elseBranch ?? '');
    return resolve(info.flags.has('#') ? chosen : trimScopedContent(chosen));
  }

  if (name === 'random' || name === 'pick') {
    const options = choiceArgs(resolvedArgs());
    if (!options.length) return '';
    const index = name === 'pick' ? hashString(options.join('\u0000')) % options.length : Math.floor(Math.random() * options.length);
    return options[index] ?? '';
  }
  if (name === 'roll') return rollDice(resolve(args[0] ?? ''));

  if (name === 'charfirstmessage' || name === 'greeting') {
    const index = Number(resolve(args[0] ?? '0'));
    if (index === 0) return state.input.character?.firstMessage ?? '';
    return state.input.character?.alternateGreetings?.[index - 1] ?? '';
  }

  if (name === 'date') return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (name === 'time') return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  if (name === 'weekday') return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date());
  if (name === 'isodate') return formatDateToken('YYYY-MM-DD');
  if (name === 'isotime') return formatDateToken('HH:mm');
  if (name === 'datetimeformat') return formatDateToken(resolve(args[0] ?? 'YYYY-MM-DD HH:mm:ss'));

  if (name === 'space') return ' '.repeat(Math.max(1, Number(resolve(args[0] ?? '1')) || 1));
  if (name === 'newline') return '\n'.repeat(Math.max(1, Number(resolve(args[0] ?? '1')) || 1));
  if (name === 'noop' || name === 'else' || name === 'banned') return '';
  if (name === 'trim') return trimScopedContent(resolve(scopedContent ?? args[0] ?? ''));
  if (name === 'reverse') return [...resolve(scopedContent ?? args[0] ?? '')].reverse().join('');
  if (name === 'hasextension') return 'false';

  state.unsupported.add(name);
  return `{{${rawExpression}}}`;
}

function renderSillyTavernTemplate(template: string, state: MacroState, depth = 0): string {
  if (!template || depth > 20) return template;

  let output = '';
  for (let index = 0; index < template.length; index += 1) {
    if (template[index] === '\\' && template.startsWith('{{', index + 1)) {
      output += '{{';
      index += 2;
      continue;
    }
    if (!template.startsWith('{{', index)) {
      output += template[index];
      continue;
    }

    const close = findMacroClose(template, index);
    if (close < 0) {
      output += template.slice(index);
      break;
    }
    const expression = template.slice(index + 2, close);
    const info = parseMacro(expression);
    if (!info) {
      output += template.slice(index, close + 2);
      index = close + 1;
      continue;
    }

    if ((info.name === 'if' || info.name === 'trim') && !info.isClosing && info.args.length <= 1) {
      const scopedClose = findScopedClose(template, close + 2, info.name);
      if (scopedClose) {
        output += renderMacro(info, expression, state, depth, template.slice(close + 2, scopedClose.open));
        index = scopedClose.close + 1;
        continue;
      }
    }

    output += renderMacro(info, expression, state, depth);
    index = close + 1;
  }
  return output;
}

function regexScripts(input: PromptCompilerInput) {
  return input.profile.regex.enabled === false ? [] : input.profile.regex.scripts;
}

function regexMacros(input: Pick<PromptCompilerInput, 'character' | 'userName'>): Record<string, string | undefined> {
  const charName = input.character?.name ?? 'Assistant';
  return {
    char: charName,
    charIfNotGroup: charName,
    user: input.userName ?? 'User'
  };
}

export function renderPromptTemplate(
  template: string,
  input: Pick<PromptCompilerInput, 'character' | 'persona' | 'userName'> & Partial<Pick<PromptCompilerInput, 'messages'>>,
  macroState?: MacroState
): string {
  const charName = input.character?.name ?? 'Assistant';
  const values: Record<string, string> = {
    char: charName,
    charIfNotGroup: charName,
    user: input.userName ?? 'User',
    description: input.character?.description ?? '',
    personality: input.character?.personality ?? '',
    scenario: input.character?.scenario ?? '',
    persona: input.persona ?? ''
  };

  if (macroState) return renderSillyTavernTemplate(template, macroState);
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), template);
}

function worldContent(input: PromptCompilerInput, position: 'before' | 'after', slot?: PromptSlot, macroState?: MacroState): string {
  const content = (input.activatedWorldEntries ?? [])
    .filter((entry) => entry.entry.position === position)
    .map((entry) => {
      const plain = applyRegexScripts(entry.entry.content, regexScripts(input), {
        placement: REGEX_PLACEMENT.WORLD_INFO,
        macros: regexMacros(input)
      });
      return applyRegexScripts(plain, regexScripts(input), {
        placement: REGEX_PLACEMENT.WORLD_INFO,
        isPrompt: true,
        macros: regexMacros(input)
      });
    })
    .filter(Boolean)
    .join('\n\n');
  return renderPromptTemplate(formatRuntimeValue(slot?.content, content), input, macroState);
}

function slotContent(slot: PromptSlot, input: PromptCompilerInput, macroState?: MacroState): string {
  if (slot.source === 'custom' || slot.source === 'system') return renderPromptTemplate(slot.content, input, macroState);
  if (slot.source === 'character-system') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.systemPrompt ?? ''), input, macroState);
  if (slot.source === 'character-description') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.description ?? ''), input, macroState);
  if (slot.source === 'character-personality') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.personality ?? ''), input, macroState);
  if (slot.source === 'scenario') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.scenario ?? ''), input, macroState);
  if (slot.source === 'persona') return renderPromptTemplate(formatRuntimeValue(slot.content, input.persona ?? ''), input, macroState);
  if (slot.source === 'worldbook-before') return worldContent(input, 'before', slot, macroState);
  if (slot.source === 'worldbook-after') return worldContent(input, 'after', slot, macroState);
  if (slot.source === 'examples') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.exampleMessages ?? ''), input, macroState);
  if (slot.source === 'post-history') return renderPromptTemplate(formatRuntimeValue(slot.content, input.character?.postHistoryInstructions ?? ''), input, macroState);
  return '';
}

function promptMessage(slot: PromptSlot, content: string): NankeMessage {
  return createMessage({
    role: slot.role,
    content,
    createdAt: Date.now(),
    metadata: {
      promptSlotId: slot.id,
      promptSlotLabel: slot.label,
      promptSlotSource: slot.source,
      ...(slot.legacy ? { legacy: slot.legacy } : {})
    }
  });
}

function squashSystemMessages(messages: NankeMessage[]): NankeMessage[] {
  const squashed: NankeMessage[] = [];
  for (const message of messages) {
    if (message.role !== 'system' || message.name || !message.content) {
      squashed.push(message);
      continue;
    }

    const previous = squashed.at(-1);
    if (previous?.role === 'system' && !previous.name) {
      previous.content = [previous.content, message.content].filter(Boolean).join('\n');
      previous.metadata = {
        ...previous.metadata,
        squashedPromptSlotIds: [
          ...((previous.metadata.squashedPromptSlotIds as string[] | undefined) ?? []),
          ...(previous.metadata.promptSlotId ? [String(previous.metadata.promptSlotId)] : []),
          ...(message.metadata.promptSlotId ? [String(message.metadata.promptSlotId)] : [])
        ]
      };
    } else {
      squashed.push(message);
    }
  }
  return squashed;
}

function injectAbsolutePrompts(messages: NankeMessage[], injections: NankeMessage[]): NankeMessage[] {
  if (!injections.length) return messages;
  const result = [...messages];
  const grouped = new Map<number, NankeMessage[]>();
  for (const injection of injections) {
    const depth = Number(injection.metadata.injectionDepth ?? 4);
    grouped.set(depth, [...(grouped.get(depth) ?? []), injection]);
  }

  const depths = [...grouped.keys()].sort((a, b) => a - b);
  let inserted = 0;
  for (const depth of depths) {
    const group = grouped.get(depth) ?? [];
    const index = Math.max(0, result.length - depth + inserted);
    result.splice(index, 0, ...group);
    inserted += group.length;
  }
  return result;
}

function absoluteInjectionMessage(slot: PromptSlot, content: string): NankeMessage {
  const message = promptMessage(slot, content);
  return {
    ...message,
    metadata: {
      ...message.metadata,
      injectionPosition: 'absolute',
      injectionDepth: slot.injection?.depth ?? 4,
      injectionOrder: slot.injection?.order ?? 100
    }
  };
}

function sortedAbsoluteMessages(injections: NankeMessage[]): NankeMessage[] {
  const roleRank: Record<string, number> = { system: 0, user: 1, assistant: 2, tool: 3 };
  return [...injections].sort((a, b) => {
    const orderA = Number(a.metadata.injectionOrder ?? 100);
    const orderB = Number(b.metadata.injectionOrder ?? 100);
    if (orderA !== orderB) return orderB - orderA;
    return (roleRank[a.role] ?? 3) - (roleRank[b.role] ?? 3);
  });
}

function compileTextMode(messages: NankeMessage[], input: PromptCompilerInput): NankeMessage[] {
  const instruct = input.profile.prompt.instruct;
  if (!instruct) return messages;

  const text = messages
    .map((message) => {
      if (message.role === 'system') return `${instruct.systemSequence}${instruct.systemSequence ? '\n' : ''}${message.content}${instruct.systemSuffix}`;
      if (message.role === 'assistant') return `${instruct.outputSequence}${instruct.outputSequence ? '\n' : ''}${message.content}${instruct.outputSuffix}`;
      return `${instruct.inputSequence}${instruct.inputSequence ? '\n' : ''}${message.content}${instruct.inputSuffix}`;
    })
    .join('');

  return [
    createMessage({
      role: 'user',
      content: text.trim(),
      createdAt: Date.now()
    })
  ];
}

export class PromptCompiler {
  compile(input: PromptCompilerInput): CompiledPrompt {
    const warnings: PromptWarning[] = [];
    const compiled: NankeMessage[] = [];
    const absoluteInjections: NankeMessage[] = [];
    const macroState = createMacroState(input);

    for (const slot of input.profile.prompt.slots) {
      if (!slot.enabled) continue;
      if (slot.injection?.triggers?.length) {
        warnings.push({ code: 'prompt-trigger-not-evaluated', message: `Prompt slot "${slot.label || slot.id}" has generation triggers that are not evaluated in this request.` });
      }
      if (slot.source === 'history') {
        compiled.push(...injectAbsolutePrompts(input.messages, sortedAbsoluteMessages(absoluteInjections)));
        continue;
      }
      if (slot.source === 'post-history') {
        const postHistory = slotContent(slot, input, macroState).trim();
        if (postHistory) {
          compiled.push(promptMessage(slot, postHistory));
        }
        const depthPrompt = input.character?.depthPrompt;
        if (depthPrompt?.prompt.trim()) {
          compiled.push(
            createMessage({
              role: depthPrompt.role,
              content: renderPromptTemplate(depthPrompt.prompt, input, macroState).trim(),
              name: 'Depth Prompt',
              createdAt: Date.now()
            })
          );
        }
        continue;
      }
      const content = slotContent(slot, input, macroState).trim();
      if (!content) continue;
      if (slot.injection?.position === 'absolute') {
        absoluteInjections.push(absoluteInjectionMessage(slot, content));
        continue;
      }
      compiled.push(promptMessage(slot, content));
    }

    if (absoluteInjections.length && !input.profile.prompt.slots.some((slot) => slot.enabled && slot.source === 'history')) {
      compiled.push(...sortedAbsoluteMessages(absoluteInjections));
    }

    if (macroState.unsupported.size) {
      warnings.push({
        code: 'unsupported-sillytavern-macros',
        message: `Unsupported SillyTavern macros left unchanged: ${[...macroState.unsupported].sort().join(', ')}.`
      });
    }

    if (compiled.length === 0) {
      warnings.push({ code: 'empty-prompt', message: 'Prompt compiled without messages.' });
    }

    const chatMessages = input.profile.prompt.squashSystemMessages ? squashSystemMessages(compiled) : compiled;
    const modeMessages = input.profile.prompt.mode === 'text' ? compileTextMode(chatMessages, input) : chatMessages;
    const { messages, report } = trimMessagesToBudget(modeMessages, input.profile.sampler.contextTokens, input.profile.sampler.maxTokens);

    return {
      messages,
      tokenReport: report,
      activatedWorldEntries: input.activatedWorldEntries ?? [],
      warnings
    };
  }
}
