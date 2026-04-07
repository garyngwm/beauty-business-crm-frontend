import { supabase } from "@/lib/supabase";

const IDLE_LIMIT_MS = 120 * 60 * 1000;      // 2 hours
const WARN_BEFORE_MS = 60 * 1000;          // warn 1 min before logout
const LOGIN_DAY_KEY = "kosme_login_day";

// Format Singapore date (YYYY-MM-DD)
function sgDayString(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function enforceDailyReloginOnLoad() {
  const today = sgDayString();
  const saved = localStorage.getItem(LOGIN_DAY_KEY);

  // If user had a session from a previous day, force sign out
  if (saved && saved !== today) {
    await supabase.auth.signOut();
    localStorage.removeItem(LOGIN_DAY_KEY);
  }
}

export function markLoginDayToday() {
  localStorage.setItem(LOGIN_DAY_KEY, sgDayString());
}

export function startIdleLogout(options: {
  onWarn: (secondsLeft: number) => void;
  onLogout: () => void;
}) {
  let idleTimer: number | undefined;
  let warnTimer: number | undefined;
  let countdownTimer: number | undefined;

  const clearAll = () => {
    if (idleTimer) window.clearTimeout(idleTimer);
    if (warnTimer) window.clearTimeout(warnTimer);
    if (countdownTimer) window.clearInterval(countdownTimer);
  };

  const schedule = () => {
    clearAll();

    // Warn 1 min before logout
    warnTimer = window.setTimeout(() => {
      let secondsLeft = WARN_BEFORE_MS / 1000;
      options.onWarn(secondsLeft);

      countdownTimer = window.setInterval(() => {
        secondsLeft -= 1;
        options.onWarn(secondsLeft);
        if (secondsLeft <= 0) {
          window.clearInterval(countdownTimer);
        }
      }, 1000);
    }, IDLE_LIMIT_MS - WARN_BEFORE_MS);

    // Logout at 30 min idle
    idleTimer = window.setTimeout(async () => {
      await supabase.auth.signOut();
      localStorage.removeItem(LOGIN_DAY_KEY);
      options.onLogout();
    }, IDLE_LIMIT_MS);
  };

  const onActivity = () => schedule();

  const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
  events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

  schedule();

  return () => {
    clearAll();
    events.forEach((e) => window.removeEventListener(e, onActivity));
  };
}
