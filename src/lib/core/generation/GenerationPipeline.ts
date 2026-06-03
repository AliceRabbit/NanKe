import { PromptCompiler } from '$lib/core/prompt/PromptCompiler';
import { WorldBookEngine } from '$lib/core/worldbook/WorldBookEngine';
import type { GenerationContext } from './ContextAssembler';

export class GenerationPipeline {
  private readonly worldBookEngine = new WorldBookEngine();
  private readonly promptCompiler = new PromptCompiler();

  compile(context: GenerationContext) {
    const activatedWorldEntries = this.worldBookEngine.activate(context.worldBooks, context.messages, {
      includeNames: true
    });

    return this.promptCompiler.compile({
      profile: context.profile,
      character: context.character,
      messages: context.messages,
      activatedWorldEntries,
      persona: context.persona
    });
  }
}
