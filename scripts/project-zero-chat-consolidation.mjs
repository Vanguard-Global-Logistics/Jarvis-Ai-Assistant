const PROJECTS = [
  {
    id: 'jarvis-ai',
    title: 'Jarvis AI',
    aliases: ['jarvis ai', 'hermes', 'aegis', 'cipher', 'hive local', 'ollama', 'qwen', 'tool bridge'],
  },
  {
    id: 'jarvis-pro',
    title: 'Jarvis Pro',
    aliases: ['jarvis pro', 'family brain', 'william brain', 'project brain', 'owner brain', '/brain'],
  },
  {
    id: 'sophisticated-sips',
    title: 'Sophisticated Sips',
    aliases: ['sophisticated sips', 'sophisticatedsips', 'coffee trailer', 'kai concierge', 'menu builder'],
  },
  {
    id: 'vanguard-performance-labs',
    title: 'Vanguard Performance Labs',
    aliases: ['vanguard performance labs', 'vpl website', 'jessie concierge', 'winged vial'],
  },
  {
    id: 'peptastic',
    title: 'Peptastic / Peptastic OS',
    aliases: ['peptastic', 'peptastic os', 'peptide inventory', 'clinic knowledge'],
  },
  {
    id: 'vanguard-global-logistics',
    title: 'Vanguard Global Logistics',
    aliases: ['vanguard global logistics', 'vanguardgloballogistics', 'management@vanguardgloballogisticsllc.com'],
  },
  {
    id: 'usa-peptides',
    title: 'USA Peptides Sales Website',
    aliases: ['usa peptides', 'usa peps', 'usapeps', 'ezformz.net/f/usa-peps', 'wholesale peptides'],
  },
  {
    id: 'vpl-competitor-pricing',
    title: 'VPL Competitor Pricing System',
    aliases: ['competitor pricing', 'blueberry bio labs', 'blueberrybiolabs', 'nightly pricing', 'price change detection'],
  },
  {
    id: 'bci-operations',
    title: 'BCI Operations / Work Automation',
    aliases: ['bci operations', 'bci agent', 'simpro', 'procore', 'job site progress', 'technician report loop'],
  },
  {
    id: 'lake-sunset-aw-26-1218',
    title: '9012 Lake Sunset Drive — AW 26-1218',
    aliases: ['9012 lake sunset', 'aw 26-1218', 'timothy lampkin', 'administrative waiver', '2.7 ft setback'],
  },
  {
    id: 'throne',
    title: 'Throne',
    aliases: ['throne os', 'throne hive', 'hive distribution', 'mother ship'],
  },
  {
    id: 'saltline',
    title: 'Saltline',
    aliases: ['saltline', 'salt line', 'marine platform'],
  },
];

const PROJECT_BY_ID = new Map(PROJECTS.map((project) => [project.id, project]));

function asText(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function messageText(message) {
  const parts = message?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(asText).filter(Boolean).join('\n');
}

function orderedMessages(conversation) {
  const mapping = conversation?.mapping;
  if (!mapping || typeof mapping !== 'object') return [];

  return Object.values(mapping)
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node?.message)
    .map(({ node, index }) => {
      const message = node.message;
      return {
        id: asText(message.id || node.id || index),
        role: asText(message?.author?.role || 'unknown'),
        createTime: Number(message?.create_time ?? Number.MAX_SAFE_INTEGER),
        text: messageText(message),
        index,
      };
    })
    .filter((message) => message.text.trim().length > 0)
    .sort((a, b) => a.createTime - b.createTime || a.index - b.index);
}

export function extractConversation(conversation) {
  const messages = orderedMessages(conversation);
  return {
    id: asText(conversation?.id || conversation?.conversation_id || ''),
    title: asText(conversation?.title || 'Untitled conversation'),
    createTime: conversation?.create_time ?? null,
    updateTime: conversation?.update_time ?? null,
    messages,
    text: messages.map((message) => `${message.role}: ${message.text}`).join('\n\n'),
  };
}

function phraseCount(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let start = 0;
  while (true) {
    const found = haystack.indexOf(needle, start);
    if (found === -1) return count;
    count += 1;
    start = found + needle.length;
  }
}

export function classifyConversation(conversation) {
  const extracted = extractConversation(conversation);
  const title = extracted.title.toLowerCase();
  const body = extracted.text.toLowerCase();

  const scores = PROJECTS.map((project) => {
    let score = 0;
    const exactTitle = project.title.toLowerCase();
    if (title === exactTitle) score += 100;
    if (title.includes(exactTitle)) score += 30;

    for (const alias of project.aliases) {
      const normalized = alias.toLowerCase();
      score += phraseCount(title, normalized) * 12;
      score += Math.min(phraseCount(body, normalized), 8) * 2;
    }

    return { projectId: project.id, score };
  }).sort((a, b) => b.score - a.score || a.projectId.localeCompare(b.projectId));

  const first = scores[0];
  const second = scores[1];
  const margin = first.score - second.score;
  const ambiguous = first.score === 0 || (second.score > 0 && margin < 4);

  return {
    projectId: ambiguous ? null : first.projectId,
    confidence: first.score === 0 ? 'none' : margin >= 12 ? 'high' : margin >= 4 ? 'medium' : 'low',
    score: first.score,
    margin,
    candidates: scores.slice(0, 3),
    extracted,
  };
}

export function consolidateConversations(conversations) {
  if (!Array.isArray(conversations)) {
    throw new TypeError('ChatGPT export must be an array of conversations.');
  }

  const projects = Object.fromEntries(PROJECTS.map((project) => [project.id, []]));
  const unclassified = [];

  for (const conversation of conversations) {
    const result = classifyConversation(conversation);
    const record = {
      id: result.extracted.id,
      title: result.extracted.title,
      createTime: result.extracted.createTime,
      updateTime: result.extracted.updateTime,
      messages: result.extracted.messages,
      confidence: result.confidence,
      score: result.score,
      candidates: result.candidates,
    };

    if (result.projectId) projects[result.projectId].push(record);
    else unclassified.push(record);
  }

  return {
    generatedAt: new Date().toISOString(),
    projectOrder: PROJECTS.map((project) => project.id),
    projects,
    unclassified,
  };
}

function isoTime(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'unknown';
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(milliseconds);
  return Number.isNaN(date.valueOf()) ? 'unknown' : date.toISOString();
}

function safeLine(value) {
  return asText(value).replaceAll('\r', '').trim();
}

export function renderProjectBrain(projectId, conversations) {
  const project = PROJECT_BY_ID.get(projectId);
  if (!project) throw new Error(`Unknown project id: ${projectId}`);

  const lines = [
    `# ${project.title} — PROJECT BRAIN`,
    '',
    '> /brain bootstrap: Load William owner context + this PROJECT BRAIN + STATUS + MASTER-PUNCHLIST. Continue only this project. Verify repository/deployment facts before changing production. Do not import requirements from another project lane.',
    '',
    `Generated source conversations: **${conversations.length}**`,
    '',
    '## Source conversations',
    '',
  ];

  if (conversations.length === 0) {
    lines.push('_No source conversations were classified into this project._', '');
    return lines.join('\n');
  }

  for (const conversation of conversations) {
    lines.push(
      `### ${safeLine(conversation.title) || 'Untitled conversation'}`,
      '',
      `- Source chat ID: \`${safeLine(conversation.id) || 'unknown'}\``,
      `- Updated: ${isoTime(conversation.updateTime)}`,
      `- Classification confidence: ${conversation.confidence}`,
      '',
    );

    for (const message of conversation.messages) {
      lines.push(`#### ${safeLine(message.role) || 'unknown'}`, '', safeLine(message.text), '');
    }
  }

  return lines.join('\n');
}

export function renderUnclassified(conversations) {
  const lines = [
    '# Project Zero — UNCLASSIFIED / REVIEW REQUIRED',
    '',
    'These conversations were intentionally not forced into a project. Review them before deleting any source chats.',
    '',
  ];

  for (const conversation of conversations) {
    lines.push(`## ${safeLine(conversation.title) || 'Untitled conversation'}`, '');
    lines.push(`- Source chat ID: \`${safeLine(conversation.id) || 'unknown'}\``);
    lines.push(`- Top candidates: ${conversation.candidates.map((item) => `${item.projectId}=${item.score}`).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function renderIndex(result) {
  const lines = [
    '# Project Zero — Chat Consolidation Index',
    '',
    `Generated: ${result.generatedAt}`,
    '',
    '| Project | Chats |',
    '| --- | ---: |',
  ];

  for (const projectId of result.projectOrder) {
    const project = PROJECT_BY_ID.get(projectId);
    lines.push(`| ${project.title} | ${result.projects[projectId].length} |`);
  }
  lines.push(`| **UNCLASSIFIED** | **${result.unclassified.length}** |`, '');
  lines.push('**Deletion rule:** source chats are not safe to delete until UNCLASSIFIED is zero and a human/AEGIS verification pass confirms unique information is preserved.');
  return lines.join('\n');
}

export { PROJECTS };
