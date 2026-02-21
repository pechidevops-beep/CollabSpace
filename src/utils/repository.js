export function detectLanguage(filename) {
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    dockerfile: 'dockerfile',
    toml: 'toml',
    ini: 'ini',
  };
  return map[ext] || 'plaintext';
}

export function buildFileTree(files) {
  const byId = new Map();
  const roots = [];

  (files ?? []).forEach((file) => byId.set(file.id, { ...file, children: [] }));

  (files ?? []).forEach((file) => {
    const node = byId.get(file.id);
    if (file.parent_id && byId.has(file.parent_id)) {
      byId.get(file.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    nodes.forEach((node) => {
      if (node.children.length) sortNodes(node.children);
    });
  };

  sortNodes(roots);
  return roots;
}

export function buildFilePathMap(files) {
  const byId = new Map();
  (files ?? []).forEach((file) => byId.set(file.id, file));

  const cache = new Map();
  const buildPath = (file) => {
    if (!file) return '';
    if (cache.has(file.id)) return cache.get(file.id);
    if (!file.parent_id) {
      cache.set(file.id, file.name || '');
      return cache.get(file.id);
    }
    const parent = byId.get(file.parent_id);
    const path = `${buildPath(parent)}/${file.name || ''}`;
    cache.set(file.id, path);
    return path;
  };

  const map = new Map();
  (files ?? []).forEach((file) => {
    map.set(file.id, buildPath(file));
  });
  return map;
}
