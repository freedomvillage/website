# Composer social footer

The idle composer reuses the current public site's five footer destinations and
icon outlines. It shows no visible platform labels; each real anchor has an
accessible name, keyboard focus and a 44px target. External destinations open
separately with noopener/noreferrer; email remains a normal mailto handoff.

The icon sprite derives exact glyph paths from the source site's SVG fonts:
- Brands: https://cdn.prod.website-files.com/60e0035471e8115799a8640b/60e046f104be8453f3f5bfe4_fa-brands-400.svg
- Regular: https://cdn.prod.website-files.com/60e0035471e8115799a8640b/60e046f0695f4a6a9e3022a7_fa-regular-400.svg

YouTube (f167), Instagram (f16d) and SoundCloud (f1be) use Brands. Kakao retains
the site's regular comment glyph (f075), and email its envelope (f0e0). These are
Font Awesome 5 Free outlines, CC BY 4.0, with attribution in the sprite. SVG font
coordinates are displayed with translate(0,448) scale(1,-1); paths are unchanged.
No remote font or new icon package is loaded.

An empty live status shows the links. Pending, error and result statuses use the
existing persistent status region instead. The privacy description remains
associated with the textarea and becomes visible when it is focused or contains
a draft. A question is sent only by the existing explicit submit action. Links,
focus and appearance changes never send the draft or invoke Jev.

The composer stays fixed at the bottom. Its existing size observer continues to
reserve the actual overlay height, including mobile wrapping and status text.
No scene, logo, masonry, ranking, publication or credential contract changes.
