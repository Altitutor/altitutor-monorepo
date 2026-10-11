/**
 * Runs before the Next/React bundles, including the error boundary's bundle.
 * Keep this native script self-contained: a missing chunk must not prevent its
 * retry control from rendering. It neither handles nor suppresses React errors.
 */
export const LOGIN_CHUNK_RECOVERY_SCRIPT = `
(function () {
  var retryKey = 'ucat-login-chunk-recovery';
  var recoveryStarted = false;
  var fallback;
  var observer;

  function showRetry() {
    if (!fallback) {
      fallback = document.createElement('section');
      fallback.id = 'ucat-login-chunk-recovery';
      fallback.setAttribute('role', 'alert');
      fallback.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:#fff;color:#111827;font-family:system-ui,sans-serif;text-align:center;box-sizing:border-box';
      var content = document.createElement('div');
      content.style.maxWidth = '360px';
      var heading = document.createElement('h1');
      heading.textContent = 'Sign-in could not load';
      heading.style.cssText = 'font-size:24px;margin:0 0 12px';
      var message = document.createElement('p');
      message.textContent = 'Check your connection, then try loading sign-in again.';
      message.style.cssText = 'line-height:1.5;margin:0 0 20px';
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Reload sign-in';
      button.style.cssText = 'border:0;border-radius:8px;padding:12px 20px;background:#111827;color:#fff;font:inherit;cursor:pointer';
      button.onclick = function () { window.location.reload(); };
      content.appendChild(heading);
      content.appendChild(message);
      content.appendChild(button);
      fallback.appendChild(content);
    }
    // React's document-level fallback can remove the application's body nodes.
    // Restore the native retry control after that fallback without its chunks.
    if (!fallback.isConnected && document.body) {
      document.body.appendChild(fallback);
      fallback.querySelector('button').focus();
    }
  }

  function recover() {
    if (window.location.pathname !== '/login' || recoveryStarted) return;
    recoveryStarted = true;
    try {
      if (window.sessionStorage.getItem(retryKey) !== '1') {
        window.sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return;
      }
    } catch (_) {
      // Without a durable guard, only an explicit user action may reload.
    }
    showRetry();
    observer = new MutationObserver(showRetry);
    observer.observe(document, { childList: true, subtree: true });
  }

  function isChunkError(error) {
    return error && (error.name === 'ChunkLoadError' ||
      /Loading chunk [^ ]+ failed/.test(error.message || ''));
  }

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target instanceof HTMLScriptElement && target.src) {
      var url = new URL(target.src, window.location.href);
      if (url.origin === window.location.origin &&
          url.pathname.indexOf('/_next/static/chunks/') === 0 &&
          /\\.js$/.test(url.pathname)) recover();
    } else if (isChunkError(event.error)) {
      recover();
    }
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    if (isChunkError(event.reason)) recover();
  });
})();
`;
