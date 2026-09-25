// Google Cast sender for "Show on TV" (docs/claude-code-spec-tv-mode.md,
// Casting). The host's phone launches the registered receiver (tv.html with
// ?cast=1) on a Chromecast or Google TV and hands it the night's code over a
// custom message channel.
//
// The Cast Web Sender SDK exists only in Chrome on Android and on the
// desktop. Everywhere else — iOS Safari above all — loadCastSender() resolves
// false and the sheet shows no Cast button, just the address to type on the
// TV. Nothing here is user-agent sniffing: the SDK itself says whether Cast
// is available.
import { CAST_APP_ID, CAST_NAMESPACE } from './config.js';

const SDK = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

let loading = null;
let listeners = [];
// The code this page last cast, re-sent to a session Chrome re-joins after a
// reload: that session's receiver never saw this page's code.
let lastCode = null;

const context = () => window.cast.framework.CastContext.getInstance();

/**
 * Loads the SDK once. Resolves true when Cast is available in this browser,
 * false otherwise (another browser, an ad blocker, no app id) — it never
 * rejects. Call it when the sheet opens, not on the Cast tap: requestSession()
 * has to run inside the tap's own user activation, so the SDK must already be
 * there by then.
 */
export function loadCastSender() {
  if (!CAST_APP_ID) return Promise.resolve(false);
  if (!loading) {
    loading = new Promise((resolve) => {
      // The SDK calls this once it knows. Defined before the tag goes in, or
      // the callback is missed.
      window.__onGCastApiAvailable = (ok) => resolve(!!ok && !!window.cast?.framework);
      const s = document.createElement('script');
      s.src = SDK;
      s.async = true;
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    }).then((ok) => {
      if (ok) setup();
      return ok;
    });
  }
  return loading;
}

function setup() {
  const { framework } = window.cast;
  context().setOptions({
    receiverApplicationId: CAST_APP_ID,
    autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  context().addEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, emit);
  context().addEventListener(framework.CastContextEventType.SESSION_STATE_CHANGED, (ev) => {
    const { SESSION_STARTED, SESSION_RESUMED } = framework.SessionState;
    if ((ev.sessionState === SESSION_STARTED || ev.sessionState === SESSION_RESUMED) && lastCode) send(lastCode);
    emit();
  });
}

/** What the sheet paints from: is there a TV to cast to, and are we on one. */
export function castState() {
  const { framework } = window.cast;
  const state = context().getCastState();
  const session = context().getCurrentSession();
  return {
    available: state !== framework.CastState.NO_DEVICES_AVAILABLE,
    connecting: state === framework.CastState.CONNECTING,
    connected: state === framework.CastState.CONNECTED,
    deviceName: session?.getCastDevice()?.friendlyName || '',
  };
}

function emit() {
  const s = castState();
  listeners.forEach((fn) => fn(s));
}

export function onCastState(fn) {
  listeners.push(fn);
}

function send(code) {
  context().getCurrentSession()?.sendMessage(CAST_NAMESPACE, { code }).catch(() => {});
}

/**
 * Opens Chrome's device picker and, once a TV is running the receiver, hands
 * it the code. Resolves false when the picker was dismissed; rejects when
 * the launch failed for a real reason.
 */
export async function castCode(code) {
  lastCode = code;
  let err;
  try { err = await context().requestSession(); } catch (e) { err = e; }
  if (err) {
    // chrome.cast.ErrorCode.CANCEL: the picker was closed, nothing to say.
    if ((err.code || err) === 'cancel') return false;
    throw err;
  }
  send(code);
  return true;
}

/** The sheet's Stop: ends the session and closes the receiver on the TV. */
export function stopCasting() {
  context().endCurrentSession(true);
}

/**
 * Leaves the session without closing the receiver, for pagehide: the host's
 * phone moves on to the swipe screen, and the TV keeps showing the night.
 */
export function leaveCast() {
  if (!window.cast?.framework) return;
  if (context().getCurrentSession()) context().endCurrentSession(false);
}
