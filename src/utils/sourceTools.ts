export type SourceDiagnosticSeverity = 'error' | 'warning';

export interface SourceDiagnostic {
  severity: SourceDiagnosticSeverity;
  message: string;
  line: number;
  column: number;
}

interface BracePosition {
  line: number;
  column: number;
}

const structuralBraces = (line: string) => {
  const braces: Array<'{' | '}'> = [];
  let quote = '';
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#') break;
    if (char === '{' || char === '}') braces.push(char);
  }

  return braces;
};

export const validateNginxSource = (source: string): SourceDiagnostic[] => {
  if (!source.trim()) {
    return [{ severity: 'error', message: '配置内容不能为空。', line: 1, column: 1 }];
  }

  const diagnostics: SourceDiagnostic[] = [];
  const braces: BracePosition[] = [];
  let line = 1;
  let column = 0;
  let quote = '';
  let quoteStart: BracePosition | null = null;
  let escaped = false;
  let comment = false;

  for (const char of source) {
    column += 1;
    if (char === '\n') {
      line += 1;
      column = 0;
      comment = false;
      escaped = false;
      continue;
    }
    if (comment) continue;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = '';
        quoteStart = null;
      }
      continue;
    }
    if (char === '#') {
      comment = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      quoteStart = { line, column };
      continue;
    }
    if (char === '{') {
      braces.push({ line, column });
      continue;
    }
    if (char === '}') {
      if (braces.length) braces.pop();
      else diagnostics.push({ severity: 'error', message: '发现没有对应开始位置的右大括号。', line, column });
    }
  }

  if (quote && quoteStart) {
    diagnostics.push({ severity: 'error', message: '字符串引号没有闭合。', ...quoteStart });
  }
  braces.slice(-5).forEach((position) => {
    diagnostics.push({ severity: 'error', message: '配置块缺少右大括号。', ...position });
  });
  return diagnostics;
};

export const sourceHasErrors = (source: string) => (
  validateNginxSource(source).some((diagnostic) => diagnostic.severity === 'error')
);

export const formatNginxConfig = (config: string) => {
  let depth = 0;
  let previousWasBlank = false;
  const output: string[] = [];

  config.split(/\r?\n/).forEach((sourceLine) => {
    const trimmed = sourceLine.trim();
    if (!trimmed) {
      if (output.length && !previousWasBlank) output.push('');
      previousWasBlank = true;
      return;
    }

    const braces = structuralBraces(trimmed);
    const closesFirst = braces[0] === '}';
    if (closesFirst) depth = Math.max(0, depth - 1);
    output.push(`${'    '.repeat(depth)}${trimmed}`);
    previousWasBlank = false;

    braces.forEach((brace, index) => {
      if (brace === '{') depth += 1;
      if (brace === '}' && !(closesFirst && index === 0)) depth = Math.max(0, depth - 1);
    });
  });

  while (output.at(-1) === '') output.pop();
  return `${output.join('\n')}\n`;
};
