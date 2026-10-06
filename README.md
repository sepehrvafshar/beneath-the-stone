# Beneath the Stone

A nonlinear, text-based browser game set across three ages of Mammoth Cave, Kentucky: pre-contact Indigenous inhabitation around 3000 BCE, the lantern-lit commercial tours of the 1840s, and a present-day preservation meeting. You play a visiting researcher. Eight tracked ethical decisions about recording, sharing, and preserving generate one of three ending reflections: the Archivist's Path, the Keeper's Path, or the Steward's Path.

Play: https://beneath-the-stone.sepehr-vaezafshar.workers.dev

Alternate address: https://beneath-the-stone.pages.dev

Recommended age 18+. Themes include Indigenous heritage, slavery, archaeological remains, and ethical decision-making.

## About the project

The game is the demonstration artifact for a design framework described in:

Vaez Afshar, S., & Shackelford, L. (2026). *Beneath the Stone: A low-resource text-based design framework for ethical digital representation of marginalized heritage.* Proceedings of SIGraDi 2026. TODO_PROCEEDINGS_LINK

The framework's four principles are narrative sovereignty, constrained representation, player reflexivity, and low-resource materiality. The game is deliberately low-resource: one HTML file, no images, no recorded audio, no external dependencies, no server, no data collection.

## Documented and invented

Places, artifact types, and documented practices are drawn from the archaeological and historical record (Carstens & Watson, 1996; National Park Service, 2025). The characters, dialogue, and specific incidents are imagined composites. The game is an independent educational work and is not affiliated with Mammoth Cave National Park or the National Park Service.

## Running locally

Open `index.html` in any modern browser. No server or build step is needed.

Developer checks (optional):

```
npm install
npx playwright install chromium
npm run check      # static checks against the paper's claims
npm run smoke      # plays to all three endings, verifies zero network requests
```

## Accessibility

- Playable with keyboard alone (Tab, Enter, Space, Escape).
- Text size and a plain reading mode are available from the top controls.
- Motion can be reduced from the top controls or by your system setting.
- Sound is optional and carries no information you need.
- No time limits; take as long as you want on every screen.

## Publishing

Source: https://github.com/sepehrvafshar/beneath-the-stone

Cloudflare Workers deploys the `main` branch. Use the build command `mkdir -p dist && cp index.html _headers dist/` and the deploy command `npx wrangler deploy --config wrangler.workers.json`. The configuration serves static assets from `dist`; the game needs no server-side application code.

The existing Cloudflare Pages site remains available and deploys the same branch, using the same build command and `dist` as its output directory. Both hosts receive the tested game unchanged, with the same security headers. Keep Web Analytics disabled so the game makes no additional network requests.

Saved sessions belong to the site address where they were created. To continue a save made on the Pages address, use that address; saves do not automatically transfer to the Workers address.

## Privacy

Nothing is transmitted. Gameplay stays in memory unless you choose Save and exit. That action saves one session, including your passage, decisions, notes, and playtest log, in this browser on this device after the browser closes. Clearing browser data removes the save. New Game leaves the previous save available until you save again. You can export a text report from the reflection screen by your own click. Accessibility preferences remain session-only.

## License

Code: MIT (`LICENSE`). Narrative text and historical notes: CC BY-NC-SA 4.0 (`LICENSE-CONTENT.md`).

## References

Carstens, K. C., & Watson, P. J. (Eds.). (1996). *Of caves and shell mounds.* University of Alabama Press.

National Park Service. (2025, March 7). *Native Americans.* Mammoth Cave National Park. https://www.nps.gov/maca/learn/historyculture/native-americans.htm

National Park Service. (2025, March 7). *Cave Discoveries From the Past.* https://www.nps.gov/articles/000/prehistoric-cave-discoveries.htm
