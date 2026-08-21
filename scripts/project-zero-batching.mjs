const DEFAULT_SOURCE_BATCH_CHAR_BUDGET = 180_000;
const MAX_MERGE_RESULTS_PER_CALL = 6;

function sourceSize(source) {
  return JSON.stringify(source).length;
}

function cloneSourceWithMessages(source, messages) {
  return { ...source, messages };
}

function splitMessageToFit(source, message, budget) {
  const text = typeof message?.text === 'string' ? message.text : '';
  const shellMessage = { ...message, text: '' };
  const envelopeSize = sourceSize(cloneSourceWithMessages(source, [shellMessage]));
  const maxTextChars = budget - envelopeSize - 256;
  if (maxTextChars < 1_000) {
    throw new Error(
      `Source chat ${String(source.sourceChatId ?? 'unknown')} has too much metadata to fit the ${budget}-character batch budget.`,
    );
  }
  if (text.length === 0) {
    throw new Error(
      `Source chat ${String(source.sourceChatId ?? 'unknown')} exceeds the batch budget without splittable text.`,
    );
  }

  const parts = [];
  for (let start = 0; start < text.length; start += maxTextChars) {
    parts.push(text.slice(start, start + maxTextChars));
  }
  return parts.map((part, index) => ({
    ...message,
    text: part,
    migrationFragment: { index: index + 1, count: parts.length },
  }));
}

function expandOversizedMessages(source, budget) {
  const messages = Array.isArray(source.messages) ? source.messages : [];
  const expanded = [];
  for (const message of messages) {
    const single = cloneSourceWithMessages(source, [message]);
    if (sourceSize(single) <= budget) expanded.push(message);
    else expanded.push(...splitMessageToFit(source, message, budget));
  }
  return expanded;
}

function splitOversizedSource(source, budget) {
  if (sourceSize(source) <= budget) return [source];
  const messages = expandOversizedMessages(source, budget);
  if (messages.length === 0) {
    throw new Error(
      `Source chat ${String(source.sourceChatId ?? 'unknown')} exceeds the batch budget without splittable messages.`,
    );
  }

  const chunks = [];
  let current = [];
  for (const message of messages) {
    const candidate = cloneSourceWithMessages(source, [...current, message]);
    if (sourceSize(candidate) <= budget) {
      current.push(message);
      continue;
    }
    if (current.length === 0) {
      throw new Error(
        `Source chat ${String(source.sourceChatId ?? 'unknown')} still exceeds the ${budget}-character batch budget after fragmentation.`,
      );
    }
    chunks.push(cloneSourceWithMessages(source, current));
    current = [message];
  }
  if (current.length > 0) chunks.push(cloneSourceWithMessages(source, current));
  return chunks;
}

export function partitionSynthesisSources(
  sources,
  { charBudget = DEFAULT_SOURCE_BATCH_CHAR_BUDGET } = {},
) {
  if (!Array.isArray(sources)) throw new TypeError('Synthesis sources must be an array.');
  if (!Number.isInteger(charBudget) || charBudget < 10_000) {
    throw new Error(
      'Synthesis source batch budget must be an integer of at least 10000 characters.',
    );
  }

  const expanded = sources.flatMap((source) => splitOversizedSource(source, charBudget));
  const batches = [];
  let current = [];
  let currentSize = 0;

  for (const source of expanded) {
    const size = sourceSize(source);
    if (current.length > 0 && currentSize + size > charBudget) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(source);
    currentSize += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function buildBatchSynthesisRequest(originalRequest, sources, batchIndex, batchCount) {
  return {
    ...originalRequest,
    batch: { index: batchIndex + 1, count: batchCount },
    instructions: [
      ...(Array.isArray(originalRequest.instructions) ? originalRequest.instructions : []),
      `This is source batch ${batchIndex + 1} of ${batchCount}. Extract only claims supported by this batch. Cross-batch deduplication and conflict detection happen later. migrationFragment fields only indicate contiguous pieces of one oversized source message; treat all fragments as the same source chat.`,
    ],
    sources,
  };
}

export function buildMergeSynthesisRequest(project, results, round, groupIndex) {
  return {
    version: 1,
    project: { id: project.id, title: project.title },
    merge: { round, group: groupIndex + 1 },
    instructions: [
      'The inputs below are already source-cited batch synthesis results, not raw transcripts.',
      'Merge and deduplicate them into one concise project synthesis.',
      'Preserve every sourceChatId needed to support each retained claim.',
      'Detect contradictions across batches and place them in conflicts.',
      'Never turn an unresolved conflict into a resolved conflict unless an input already contains an explicit resolution supported by source IDs.',
      'Do not invent new claims or source IDs.',
      'Return only the required structured synthesis object.',
    ],
    verifiedBatchResults: results,
  };
}

export function groupMergeResults(results, size = MAX_MERGE_RESULTS_PER_CALL) {
  if (!Array.isArray(results)) throw new TypeError('Merge results must be an array.');
  if (!Number.isInteger(size) || size < 2) {
    throw new Error('Merge group size must be at least 2.');
  }
  const groups = [];
  for (let index = 0; index < results.length; index += size) {
    groups.push(results.slice(index, index + size));
  }
  return groups;
}

export { DEFAULT_SOURCE_BATCH_CHAR_BUDGET, MAX_MERGE_RESULTS_PER_CALL };
