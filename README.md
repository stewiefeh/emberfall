# Emberfall

A cinematic survival arcade game for the browser. You are the last light-keeper:
your torch is your clock, your health, and your weapon. Shades gather at the
edge of your light and wait for it to gutter. Embers pay more the deeper into
the dark you push, but nothing you carry counts until you bring it back to the
campfire and bank it.

## Play

Live at: `https://stewiefeh.github.io/emberfall/`

- WASD or arrow keys to move (touch to steer on mobile)
- The torch burns fuel constantly. In light, shades burn; brush against one
  while lit and it dies, but it costs fuel
- Bank embers at the campfire to score. Carried embers are lost if the dark
  takes you
- Survive a night, choose a boon at dawn, and the next night is longer, darker,
  and hungrier

## Stack

No framework, no build step: TypeScript-free ES modules, Canvas 2D with an
additive light pass, a fixed-timestep game loop, procedural WebAudio sound,
and film grain. Static files, deployable anywhere; this repo ships to GitHub
Pages on every push to `main` via GitHub Actions.
