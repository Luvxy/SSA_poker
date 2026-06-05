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

## Console setup for monetization

Register these ad groups in the Apps in Toss console before test release:

- `game_end_interstitial`: full-screen ad after a completed game. The client skips the first completed game and requests it from the second game onward.
- `rewarded_cosmetic_ticket`: rewarded ad for one cosmetic ticket. The client limits rewards to three per local day.

Register these one-time purchase products. Keep the SKU values exactly as written:

- `skin_pack_classic`: 클래식 스킨팩, non-consumable, grants 클래식 카드 뒷면 and 클래식 테이블.
- `skin_pack_neon`: 네온 스킨팩, non-consumable, grants 네온 카드 뒷면 and 네온 테이블.
- `skin_pack_gold`: 골드 스킨팩, non-consumable, grants 골드 카드 뒷면, 골드 테이블, and 골드 승리 배지.
- `cosmetic_ticket_5`: 꾸미기 티켓 5장, consumable.
- `cosmetic_ticket_15`: 꾸미기 티켓 15장, consumable.

## Release verification

- Build the latest artifact with `npm run build` and upload `ssachik-poker.ait`; do not commit the `.ait` file.
- In the Apps in Toss test environment, verify room creation, room list join, quick match, room code join, game start, and one completed round with at least two devices.
- Verify rewarded ads grant exactly one cosmetic ticket and stop after three rewards on the same day.
- Verify interstitial ads are not requested after the first completed game and are requested from the second completed game onward.
- Verify IAP purchase, pending order restore, cosmetic grant, ticket grant, and grant completion for every SKU.
- Confirm paid products never grant game coins, betting power, card purchase power, or win-rate advantages.
- Confirm privacy, terms, rules, contact, `ads.txt`, `robots.txt`, and `sitemap.xml` URLs remain reachable before submitting for review.
