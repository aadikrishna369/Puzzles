# Puzzles

A dark, animated landing page + product hub. Every tool lives in its own folder under `tools/`
and appears on the site automatically.

## Structure

```
PUZZLES/
├── index.html            Homepage / landing page
├── about.html            About
├── contact.html          Contact form + FAQ (edit the email address at the bottom of the file)
├── 404.html              Custom error page
├── server.js             Local server with LIVE tool detection
├── build.js              Regenerates tools/manifest.js (for static hosting)
├── scan-tools.js         Reads the tool folders + info.txt files
├── package.json
├── assets/
│   ├── css/site.css      Shared styles
│   ├── js/site.js        Header, footer, animations
│   ├── js/hub.js         The dynamic product hub
│   └── favicon.svg
└── tools/
    ├── index.html        All tools directory (search + category filter)
    ├── manifest.js       Auto-generated list of tools (do not edit)
    ├── _template/        Copy this to start a new tool (ignored by the hub)
    └── image-to-pdf/     Your first tool
        ├── index.html
        ├── style.css
        ├── script.js
        ├── info.txt      What the homepage shows about the tool
        └── assets/thumbnail.png
```

## Run it

```
node server.js          # then open http://localhost:3000
```

Needs Node.js 16+ and no packages. With the server running, **new folders in `tools/` show up
on the site within ~8 seconds - no rebuild, no refresh needed.**

## Add a new tool

1. Copy `tools/_template` to `tools/your-tool-name`.
2. Build the tool in its `index.html`, `style.css` and `script.js`.
3. Edit `info.txt` (name, tagline, description, category, icon, tags, status, featured, order).
4. Optional: add `assets/thumbnail.png` (1200x750 looks best).

Folders starting with `_` or `.` are ignored. `status: soon` shows a non-clickable "Coming soon" card.

## Hosting on a static host (Netlify, GitHub Pages, any web host)

A browser cannot list folders by itself, so on static hosting the hub reads `tools/manifest.js`.
Run `node build.js` after adding or changing a tool and upload the result
(or set the host's build command to `node build.js`). The live auto-detect needs `server.js`
running (any Node host works).

`contact.html` has no backend: the form opens the visitor's email app. Replace
`hello@puzzles.example` at the bottom of that file with your address.
