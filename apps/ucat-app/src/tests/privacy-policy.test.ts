import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";

type Element = { props: Record<string, unknown> };
const privacyUrl = "https://altitutor.com/mobile-privacy/";

// Render the real routes with native bridges stubbed. This exercises button
// wiring and recovery; a helper-only test would miss either caller.
function renderPrivacyButton(route: string, browserFails = false, linkingFails = true) {
  const calls: string[] = [];
  const alerts: string[][] = [];
  const pending: Promise<unknown>[] = [];
  const jsx = (_type: unknown, props: Element["props"]): Element => ({ props });
  const mocks: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useState: () => [null, () => undefined] },
    "react-native": {
      Linking: { openURL: (url: string) => {
        calls.push(`external:${url}`);
        const result = linkingFails ? Promise.reject(new Error(`Unable to open URL: ${url}`)) : Promise.resolve();
        pending.push(result.catch(() => undefined));
        return result;
      } },
      Alert: { alert: (...args: string[]) => alerts.push(args) },
      useWindowDimensions: () => ({ height: 900 }),
    },
    "expo-web-browser": { openBrowserAsync: async (url: string) => {
      calls.push(`browser:${url}`);
      if (browserFails) throw new Error("Browser unavailable");
      return { type: "dismiss" };
    } },
    "expo-status-bar": {},
    "expo-router/stack": { Stack: { Screen: "StackScreen" } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    "@/components/ui": { useColors: () => ({}) },
    "@/features/settings/theme": { useAppTheme: () => ({ scheme: "light" }) },
    "@/lib/supabase": { configured: true },
    "@/lib/haptics": { haptic: () => undefined },
    "@/features/auth/browser-auth": {},
    "@/features/notifications/push": {},
    "@/components/app-icon": {},
  };
  const load = (path: string): Record<string, unknown> => {
    const module = { exports: {} as Record<string, unknown> };
    const code = transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    new Script(`(function(require,module,exports){${code}\n})`, { filename: path })
      .runInThisContext()((name: string) => {
        if (name in mocks) return mocks[name];
        if (name.startsWith("@/")) return load(resolve("src", `${name.slice(2)}.ts`));
        throw new Error(`Unexpected import: ${name}`);
      }, module, module.exports);
    return module.exports;
  };
  const component = load(resolve("src/app", route)).default as () => Element;
  const find = (node: unknown): Element | undefined => {
    if (Array.isArray(node)) {
      for (const child of node) { const found = find(child); if (found) return found; }
    }
    if (node && typeof node === "object" && "props" in node) {
      const element = node as Element;
      if (element.props.title === "Privacy policy" || element.props.children === "Privacy policy") return element;
      return find(element.props.children);
    }
    return undefined;
  };
  const button = find(component());
  assert.ok(button, `Privacy policy button missing from ${route}`);
  return {
    calls, alerts,
    press: async () => {
      (button.props.onPress as () => void)();
      await Promise.all(pending);
      await new Promise<void>((done) => setImmediate(done));
    },
  };
}

for (const route of ["login.tsx", "settings/index.tsx"]) {
  test(`${route}: a rejected external privacy link opens the in-app browser`, async () => {
    const screen = renderPrivacyButton(route);
    await screen.press();
    assert.deepEqual(screen.calls, [`external:${privacyUrl}`, `browser:${privacyUrl}`]);
    assert.deepEqual(screen.alerts, []);
  });
  test(`${route}: if both browsers fail, show a recoverable message containing the public URL`, async () => {
    const screen = renderPrivacyButton(route, true);
    await screen.press();
    assert.equal(screen.alerts.length, 1);
    assert.match(screen.alerts[0][0], /Unable to open privacy policy/);
    assert.ok(screen.alerts[0][1].includes(privacyUrl));
  });
  test(`${route}: a successful external open needs no fallback`, async () => {
    const screen = renderPrivacyButton(route, false, false);
    await screen.press();
    assert.deepEqual(screen.calls, [`external:${privacyUrl}`]);
    assert.deepEqual(screen.alerts, []);
  });
}
