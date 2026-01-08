I have identified the causes of the "profile settings loss" and "infinite loading" issues.

### 1. Infinite Loading Fix
**Problem:** The `refreshProfile` function sets `loading` to `true` but fails to reset it to `false` if a profile fetch is already in progress (race condition).
**Solution:**
- Update `refreshProfile` in `AuthContext.tsx` to ensure `loading` is always reset to `false`, even if the fetch is skipped or fails.

### 2. Profile Configuration Loss Fix
**Problem:** When the page reloads, multiple authentication events trigger `loadProfile`. If a subsequent fetch fails (e.g., database glitch or "Row Not Found" error), the system blindly overwrites your valid profile with a "fallback" profile that only contains your email.
**Solution:**
- Modify `loadProfile` to **preserve the existing profile** if a fetch fails with a "Not Found" error, instead of overwriting it with a blank one.
- Add a check to prevent redundant profile fetches if the user is already loaded.
- Add better logging to identify why the database might be returning "Not Found" (e.g., verifying User ID matches).

### Plan of Action
1.  **Modify `context/AuthContext.tsx`**:
    -   Refactor `refreshProfile` to handle `loading` state safely.
    -   Update `loadProfile` to implement the "preserve existing data" logic.
    -   Optimize `onAuthStateChange` to skip unnecessary re-fetches.

This will stabilize the profile loading and prevent the UI from getting stuck or reverting to default settings.