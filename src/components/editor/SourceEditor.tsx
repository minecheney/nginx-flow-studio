import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { indentUnit, StreamLanguage } from '@codemirror/language';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { lintGutter, linter, type Diagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import { validateNginxSource } from '@/utils/sourceTools';
import type { SourceNodeRange } from '@/utils/sourceLocator';

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  focusTarget?: (SourceNodeRange & { requestId: number }) | null;
}

const directiveNames = [
  'worker_processes', 'worker_connections', 'error_log', 'pid', 'events', 'http', 'stream',
  'include', 'default_type', 'sendfile', 'tcp_nopush', 'keepalive_timeout', 'client_max_body_size',
  'server_tokens', 'gzip', 'gzip_vary', 'gzip_min_length', 'gzip_types', 'upstream', 'server',
  'listen', 'server_name', 'root', 'index', 'access_log', 'location', 'proxy_pass',
  'proxy_http_version', 'proxy_set_header', 'proxy_cache_bypass', 'proxy_no_cache', 'try_files',
  'return', 'rewrite', 'add_header', 'allow', 'deny', 'auth_basic', 'auth_basic_user_file',
  'ssl_certificate', 'ssl_certificate_key', 'ssl_protocols', 'ssl_ciphers', 'least_conn', 'ip_hash',
  'keepalive', 'hash', 'max_fails', 'fail_timeout', 'proxy_connect_timeout', 'proxy_timeout',
  'proxy_socket_keepalive', 'map', 'limit_req_zone', 'limit_req', 'log_format', 'resolver',
];

const completionOptions = directiveNames.map((label) => ({
  label,
  type: ['events', 'http', 'stream', 'upstream', 'server', 'location', 'map'].includes(label) ? 'keyword' : 'property',
  detail: label === 'location' ? 'URI 匹配配置块' : label === 'proxy_pass' ? '代理目标' : 'Nginx 指令',
}));

const nginxCompletions = (context: CompletionContext) => {
  const token = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*$/);
  if (!token && !context.explicit) return null;
  return { from: token?.from ?? context.pos, options: completionOptions };
};

const sourceLinter = linter((view) => {
  const doc = view.state.doc;
  return validateNginxSource(doc.toString()).map<Diagnostic>((diagnostic) => {
    const line = doc.line(Math.min(Math.max(1, diagnostic.line), doc.lines));
    const from = Math.min(line.to, line.from + Math.max(0, diagnostic.column - 1));
    return {
      from,
      to: Math.min(line.to, from + 1),
      severity: diagnostic.severity,
      message: diagnostic.message,
    };
  });
});

const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'hsl(var(--code-background))', color: 'hsl(var(--foreground))', fontSize: '12px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: '"JetBrains Mono", Consolas, monospace', lineHeight: '1.7' },
  '.cm-content': { padding: '12px 0 24px', caretColor: 'hsl(var(--primary))' },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--card))',
    color: 'hsl(var(--muted-foreground))',
    borderRight: '1px solid hsl(var(--border))',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'hsl(var(--primary) / .08)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'hsl(var(--primary) / .25)' },
  '.cm-cursor': { borderLeftColor: 'hsl(var(--primary))' },
  '.cm-tooltip': { border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
}, { dark: true });

export function SourceEditor({
  value,
  onChange,
  onSave,
  focusTarget,
}: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        basicSetup,
        StreamLanguage.define(nginx),
        indentUnit.of('    '),
        autocompletion({ override: [nginxCompletions], activateOnTyping: true }),
        sourceLinter,
        lintGutter(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': 'Nginx 源码编辑器',
          'aria-multiline': 'true',
          spellcheck: 'false',
        }),
        keymap.of([{
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onSaveRef.current();
            return true;
          },
        }]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        editorTheme,
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !focusTarget) return;
    const length = view.state.doc.length;
    const from = Math.max(0, Math.min(focusTarget.focusFrom, length));
    const to = Math.max(from, Math.min(focusTarget.focusTo, length));
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: 'center' }),
    });
  }, [focusTarget]);

  return <div className="h-full min-h-0" ref={hostRef} />;
}
