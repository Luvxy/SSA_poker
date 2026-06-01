# Apps in Toss build notes

This branch is the Apps in Toss mini-app copy of SSA Poker.

## App identity

- Korean name: 싸칙 포커
- English name: SSA Poker
- Proposed appName: `ssachik-poker`
- Entry point: `index.html`
- Runtime flag: `window.SSA_POKER_APPINTOS`

## Current branch changes

- Removed Google AdSense script from the mini-app entry.
- Added `viewport-fit=cover` for Toss in-app safe areas.
- Added `appintos.js` for platform-specific runtime metadata.
- Added `body.appintos-shell` styling so the game opens directly on the play setup screen.
- Kept Firebase multiplayer code intact for room creation and joining.

## Apps in Toss checklist

- Do not embed this game in an iframe.
- Use an appName made from lowercase English letters, numbers, and hyphens.
- Keep the first screen service-oriented, not a marketing landing page.
- Prepare customer support contact, privacy policy, and terms pages.
- Re-check Firebase domains and Firestore rules for the Toss mini-app URL before launch.
- If coins become purchasable or exchangeable outside gameplay, review Apps in Toss IAP/payment requirements before release.

## Next build tasks

1. Confirm the final Apps in Toss console appName.
2. Create a 512x512 app icon and loading artwork.
3. Test the mini-app inside the Apps in Toss test environment.
4. Decide whether guest room play needs Toss login or can stay nickname-based.
5. Prepare screenshots and app registration copy.
