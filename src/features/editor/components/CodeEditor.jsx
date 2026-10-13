import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { useTheme } from '../../../context/ThemeContext';

export default function CodeEditor({ value, onChange, language }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const isUpdatingRef = useRef(false);
  const { resolvedTheme } = useTheme();

  // Keep onChange ref always up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: value || '',
      language: language || 'plaintext',
      theme: resolvedTheme === 'light' ? 'vs' : 'vs-dark',
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
      // Skip onChange when we're programmatically updating the value (tab switch)
      if (isUpdatingRef.current) return;
      onChangeRef.current?.(model.getValue());
    });

    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  // Sync theme changes with Monaco
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(resolvedTheme === 'light' ? 'vs' : 'vs-dark');
    }
  }, [resolvedTheme]);

  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== value) {
        // Flag that we're doing a programmatic update so onChange doesn't fire
        isUpdatingRef.current = true;
        editorRef.current.pushUndoStop();
        model.pushEditOperations(
          [],
          [
            {
              range: model.getFullModelRange(),
              text: value || '',
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
      monaco.editor.setModelLanguage(model, language || 'plaintext');
    }
  }, [language]);

  return <div ref={containerRef} className="h-full w-full" />;
}
