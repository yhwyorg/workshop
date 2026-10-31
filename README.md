# Sermon Workshop — workshop.yhwh.rest

Soli Deo gloria. Made for Darrell W. Johnson.

A yellow legal pad for working through a passage and building a sermon. Open a pad
on a passage, mark the words that stand out (tap: underline, circle, box), and work
down the sheets: Observe, Questions, Connections, Big idea, Outline, Illustrations,
Application. Print your notes, or print the passage beside ruled lines on legal
paper to write on by hand. Companion to [Gospel Parallels](https://gospels.yhwh.rest).

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

## Where pads live

In the browser that made them (localStorage), with export and import as a file.
There is no server. If the saved data is ever unreadable, the workshop says so and
offers to download it; it never starts empty over it, since the next save would
overwrite it. Records carry ids and timestamps so syncing can be added later.

## Skins

A skin is a JSON description of the paper, inks, desk and fonts (from a fixed set),
in the `workshop-skin/1` format documented in `src/lib/skin.ts`. Skins are data,
never CSS or script, because they come from strangers and pads hold private notes:
`validateSkin` refuses web addresses, anything that is not a plain color or number,
and text that would be hard to read (WCAG contrast). The Skins page gives a prompt
to paste into any AI, and accepts what it writes back.

The paper itself (fibres, mottling, the lit tooth of the surface, the binding and
the sheets beneath) is drawn by `src/lib/paper.ts` and the stylesheet from a skin's
numbers; skins tune it but cannot change how it is drawn.

## Text

World English Bible (public domain), all 66 books, from eBible.org:

```sh
curl -L -o engwebp_vpl.zip https://eBible.org/Scriptures/engwebp_vpl.zip
unzip engwebp_vpl.zip -d engwebp
npm run text -- engwebp/engwebp_vpl.txt
```

The build checks every book's chapter count and the total of 31,103 verses.

## Hosting

GitHub Pages from `.github/workflows/deploy.yml` (tests and lint first). DNS for
yhwh.rest is on Cloudflare: `workshop` is a `CNAME` to `yhwyorg.github.io` and must
stay **DNS only** (grey cloud), or GitHub cannot issue its HTTPS certificate.
