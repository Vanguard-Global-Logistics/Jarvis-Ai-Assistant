import type { ChatRequest } from '@jarvis/contracts';

export type ChatRoute = 'fast' | 'balanced' | 'reasoning';

export interface HiveModelSet {
  defaultModel: string;
  fastModel?: string | undefined;
  reasoningModel?: string | undefined;
}

const REASONING_MARKERS =
  /\b(analy[sz]e|architecture|calculate|compare|debug|design|diagnose|explain why|investigate|proof|reason step|refactor|security|threat model|trade-?offs?)\b/i;
const CODE_MARKERS =
  /```|(?:^|\n)\s*(?:class|def|function|import|interface|const|let|SELECT|UPDATE|INSERT)\b|(?:TypeError|ReferenceError|SyntaxError):/m;
const MATH_MARKERS = /(?:\d\s*[+*/^=]\s*\d)|[∑∫√]/;

/**
 * A conservative, deterministic first-stage router inspired by OpenJarvis's
 * tested heuristic routing. It never sends content anywhere; it only chooses
 * among models already approved for the same loopback-only Hive provider.
 */
export function classifyChatRequest(request: ChatRequest): ChatRoute {
  const content = [...request.messages]
    .reverse()
    .find((message) => message.role === 'user')
    ?.content.trim();

  if (content === undefined || content === '') {
    return 'balanced';
  }

  if (
    content.length >= 600 ||
    REASONING_MARKERS.test(content) ||
    CODE_MARKERS.test(content) ||
    MATH_MARKERS.test(content)
  ) {
    return 'reasoning';
  }

  if (content.length <= 160) {
    return 'fast';
  }

  return 'balanced';
}

export function selectHiveChatModel(request: ChatRequest, models: HiveModelSet): string {
  const route = classifyChatRequest(request);

  if (route === 'fast' && models.fastModel !== undefined && models.fastModel !== '') {
    return models.fastModel;
  }

  if (
    route === 'reasoning' &&
    models.reasoningModel !== undefined &&
    models.reasoningModel !== ''
  ) {
    return models.reasoningModel;
  }

  return models.defaultModel;
}
