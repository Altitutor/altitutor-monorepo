import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { Script } from 'node:vm';
import { flattenTopicFilesForNav, type ResourceFile } from '@altitutor/shared';
import { createElement } from 'react';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';

const file: ResourceFile = {
  id: 'file', topicId: 'topic', code: '1', type: 'NOTES', index: 0,
  filename: 'Lesson notes', mimetype: 'application/pdf', storagePath: 'notes.pdf',
  bucket: 'resources', externalUrl: null, isSolutions: false, isSolutionsOfId: null,
};

type FilesQuery = {
  data?: ResourceFile[];
  isPending: boolean;
  isError: boolean;
  error?: Error;
};

// Load the real route while replacing native bridges and its query boundary.
// Real React rendering retains the route's initial state and render behavior.
function renderResourceFile(query: FilesQuery) {
  const mocks: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    '@altitutor/shared': { flattenTopicFilesForNav },
    'expo-router': {
      Stack: { Screen: () => null },
      useLocalSearchParams: () => ({ fileId: file.id, topicId: file.topicId, singleFile: '1' }),
      useNavigation: () => ({}), useRoute: () => ({ key: 'resource-file' }), useRouter: () => ({}),
    },
    'react-native': { View: 'div', Text: 'span', ActivityIndicator: 'progress' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/components/student-ui': {
      ErrorBlock: ({ message }: { message: string }) => createElement('span', null, message),
    },
    '@/features/resources/resource-navigation': { useFileNavigation: () => ({ current: null }) },
    '@/features/resources/resource-player': { ResourcePlayer: () => createElement('iframe', { title: 'Resource' }) },
    '@/features/resources/resource-toolbar': {},
    '@/hooks/use-student-data': { useResourceFiles: () => query },
    '@/hooks/use-theme': { useTheme: () => ({}) },
    '@/lib/student-api': {},
  };
  const path = resolve('src/app/resource-file/[fileId].tsx');
  const code = transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} as { default?: () => ReturnType<typeof createElement> } };
  new Script(`(function(require,module,exports){${code}\n})`, { filename: path })
    .runInThisContext()((name: string) => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected import: ${name}`);
    }, module, module.exports);
  assert.ok(module.exports.default);
  return renderToStaticMarkup(createElement(module.exports.default));
}

test('opening a resource before its files load renders a loading indicator', () => {
  assert.match(renderResourceFile({ isPending: true, isError: false }), /<progress/);
});

test('opening an unavailable resource renders the recovery message', () => {
  assert.match(renderResourceFile({ data: [], isPending: false, isError: false }), /This file is no longer available/);
});

test('a failed resource query displays its error without crashing', () => {
  assert.match(renderResourceFile({ isPending: false, isError: true, error: new Error('Unable to load files') }), /Unable to load files/);
});

test('a cached stored resource waits for its file URL', () => {
  assert.match(renderResourceFile({ data: [file], isPending: false, isError: false }), /<progress/);
});

test('a cached external resource reaches its player on the first render', () => {
  assert.match(renderResourceFile({ data: [{ ...file, externalUrl: 'https://example.test/lesson' }], isPending: false, isError: false }), /<iframe/);
});
