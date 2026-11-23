[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Andd291/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/Andd291/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar City — an open-world crime game

A complete original 2D top-down open-world crime game for the make.fun bounty
["Make GTA 6"](https://make.fun/bounty/gta6-01), built by an AI agent. It plays
offline in a desktop browser from static files under `game/` — no network, no
libraries, no Rockstar assets. Everything in it is original: the city, the
characters, the vehicles, the story, the art and the sound.

You are Danny Cole, a driver in debt to the fixer Mara Quinn. Work four missions
across Solmar City — a sun-soaked coastal grid of streets, traffic, pedestrians,
a park, a plaza and a beach — steal cars, dodge a 1–5 star wanted system and
police chases, and fight on foot, until the story is done and the city is yours.

## What's in the game

- **A city to drive and walk:** 3200×2400 of streets, blocks, buildings, a park,
  a plaza and a beach, with a camera that scrolls over it all.
- **Cars:** sedans, taxis, pickups and sports cars — parked and in traffic,
  stealable (the driver flees and the heat rises), drivable with arcade handling.
- **Pedestrians** who walk the sidewalks and flee from gunfire, speeding cars
  and flying fists.
- **Wanted system:** 1–5 stars for theft, assault and shooting; police cars chase
  and ram you; the heat decays when you stay out of sight.
- **Four story missions** with minimap markers, cash rewards and progression:
  steal wheels for Mara, run a timed package delivery, collect from three
  debtors, then survive a three-star getaway to the safehouse.
- **Combat on foot:** punch (F), pistol with mouse aim and click / Space.
- **HUD:** health, cash, wanted stars, minimap, objective, speed, mission timer.
- **Start screen, pause, game over and restart**, plus a localStorage save that
  remembers your cash and mission progress.
- **Sound:** everything is synthesised with WebAudio — engine hum, sirens,
  gunshots, punches, crashes and mission jingles. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive (up = accelerate, down = brake/reverse, left/right = steer) |
| E | Enter / exit car (also collects from a debtor up close) |
| F | Punch |
| Mouse + click / Space | Aim and shoot |
| P / Esc | Pause |
| R | Restart after being wasted (or wipe the save on the title screen) |

## Play it

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly in a browser (ES modules, no build step).

## Screenshots

The four shots in `screenshots/` are deterministic scenes from the real game,
staged by `game/src/shots.js` (`?shot=cover|drive|mission|wanted&seed=1`):

1. `1-cover.png` — Danny in a sports car on the main drag, mission 1 ahead
2. `2-drive.png` — flat out down the coastal road by the beach
3. `3-mission.png` — on foot at the docks, package marker ahead
4. `4-wanted.png` — three stars, two police cars closing in

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with the vendored make.fun library.

## License

MIT — see [LICENSE](LICENSE).
