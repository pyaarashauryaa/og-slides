// CometChat gives every new app these 5 ready-made users (cometchat-uid-1 .. 5).
// The real display name comes from CometChat after login.
export const TEST_USERS = [1, 2, 3, 4, 5].map((n) => ({
  uid: `cometchat-uid-${n}`,
  label: `Test user ${n}`,
}));

const KEY = "ogslides.testUid";

export function readSavedUid() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveUid(uid) {
  try {
    if (uid) sessionStorage.setItem(KEY, uid);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage can be blocked; the app still works */
  }
}
