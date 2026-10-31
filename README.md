# Sermon Workshop — workshop.yhwh.rest

Soli Deo gloria. Made for Darrell W. Johnson.

A quiet desk for working on a passage: the Bible open on one side, a yellow legal
pad on the other, and nothing else on screen. Begin a study the way a Bible is
opened (its contents, then a chapter), mark words on the page (tap: underline,
circle, box), and write on the pad by hand with an Apple Pencil or with the
keyboard. Print your notes, or print the passage beside ruled lines on legal
paper. Everything else is in one corner menu. Companion to
[Gospel Parallels](https://gospels.yhwh.rest).

![A study on an iPad held sideways](docs/screenshots/study-ipad-landscape.jpg)

Both pages keep one width (548px) whether an iPad is upright or sideways, as
paper does, so ink written in one orientation stays on its words in the other.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

## Where studies live

In the browser that made them (localStorage), with "Save a copy" and "Open a saved
copy" as a file. Studies were first called "pads": the storage key and the old file
format are still read, so nothing saved under the old name is lost.
There is no server. If the saved data is ever unreadable, the workshop says so and
offers to download it; it never starts empty over it, since the next save would
overwrite it. Records carry ids and timestamps so syncing can be added later.

## Paper styles

A paper style (a "skin" in the code) is a JSON description of the paper, inks, desk and fonts (from a fixed set),
in the `workshop-skin/1` format documented in `src/lib/skin.ts`. Skins are data,
never CSS or script, because they come from strangers and pads hold private notes:
`validateSkin` refuses web addresses, anything that is not a plain color or number,
and text that would be hard to read (WCAG contrast). The Paper page gives a prompt
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

Changes arrive as pull requests; `.github/workflows/ci.yml` runs the tests, lint and
build on each. Merging into `main` publishes through `.github/workflows/deploy.yml`
to GitHub Pages. DNS for
yhwh.rest is on Cloudflare: `workshop` is a `CNAME` to `yhwyorg.github.io` and must
stay **DNS only** (grey cloud), or GitHub cannot issue its HTTPS certificate.
