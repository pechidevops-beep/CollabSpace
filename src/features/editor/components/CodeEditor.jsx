import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { useTheme } from '../../../context/ThemeContext';

// Configure Monaco Environment with Vite web worker instances
if (typeof window !== 'undefined' && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') {
        return new jsonWorker();
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker();
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker();
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker();
      }
      return new editorWorker();
    },
  };
}

let themesDefined = false;

function ensureThemes() {
  if (themesDefined) return;

  monaco.editor.defineTheme('collabspace-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'F5F5F7' },
      { token: 'comment', foreground: '6E6E73', fontStyle: 'italic' },
      { token: 'keyword', foreground: '3DDC97', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'F5F5F7' },
      { token: 'string', foreground: '64D2FF' },
      { token: 'number', foreground: 'FF9F0A' },
      { token: 'type', foreground: 'BF5AF2' },
      { token: 'delimiter', foreground: 'A1A1A6' },
    ],
    colors: {
      'editor.background': '#141416',
      'editor.foreground': '#F5F5F7',
      'editorLineNumber.foreground': '#6E6E73',
      'editorLineNumber.activeForeground': '#3DDC97',
      'editor.lineHighlightBackground': '#18181B',
      'editorCursor.foreground': '#3DDC97',
      'editor.selectionBackground': '#3DDC9733',
      'editor.inactiveSelectionBackground': '#3DDC971A',
    },
  });

  monaco.editor.defineTheme('collabspace-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '1D1D1F' },
      { token: 'comment', foreground: '8E8E93', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0A7F52', fontStyle: 'bold' },
      { token: 'identifier', foreground: '1D1D1F' },
      { token: 'string', foreground: '0071A4' },
      { token: 'number', foreground: 'B45309' },
      { token: 'type', foreground: '8944AB' },
      { token: 'delimiter', foreground: '6E6E73' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#1D1D1F',
      'editorLineNumber.foreground': '#8E8E93',
      'editorLineNumber.activeForeground': '#0A7F52',
      'editor.lineHighlightBackground': '#F5F5F8',
      'editorCursor.foreground': '#0A7F52',
      'editor.selectionBackground': '#0A7F5222',
      'editor.inactiveSelectionBackground': '#0A7F5211',
    },
  });

  themesDefined = true;
}

export default function CodeEditor({
  value,
  onChange,
  language,
  onCursorChange,
  onSaveShortcut,
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const isUpdatingRef = useRef(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    onSaveShortcutRef.current = onSaveShortcut;
  }, [onSaveShortcut]);

  useEffect(() => {
    if (!containerRef.current) return;

    ensureThemes();
    const activeTheme = resolvedTheme === 'light' ? 'collabspace-light' : 'collabspace-dark';

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: value || '',
      language: language || 'plaintext',
      theme: activeTheme,
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
      padding: { top: 12, bottom: 12 },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderWhitespace: 'selection',
    });

    const model = editorRef.current.getModel();
    model.onDidChangeContent(() => {
      if (isUpdatingRef.current) return;
      onChangeRef.current?.(model.getValue());
    });

    editorRef.current.onDidChangeCursorPosition((e) => {
      onCursorChangeRef.current?.({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Add Command+S / Ctrl+S keybinding
    editorRef.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveShortcutRef.current?.();
    });

    // Immediate layout pass
    setTimeout(() => {
      editorRef.current?.layout();
    }, 50);

    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  // Sync theme changes with Monaco
  useEffect(() => {
    if (editorRef.current) {
      ensureThemes();
      const activeTheme = resolvedTheme === 'light' ? 'collabspace-light' : 'collabspace-dark';
      monaco.editor.setTheme(activeTheme);
      editorRef.current.layout();
    }
  }, [resolvedTheme]);

  // Sync external value updates (tab switch or reload)
  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== value) {
        isUpdatingRef.current = true;
        editorRef.current.pushUndoStop();
        model.pushEditOperations(
          [],
          [
            {
              range: model.getFullModelRange(),
              text: value ?? '',
            },
          ],
          () => null
        );
        editorRef.current.pushUndoStop();
        isUpdatingRef.current = false;
      }
    }
  }, [value]);

  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language || 'plaintext');
      }
    }
  }, [language]);

  return <div ref={containerRef} className="h-full w-full relative" />;
}
