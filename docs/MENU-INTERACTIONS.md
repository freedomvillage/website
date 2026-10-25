# Clear Windows menu

The existing canonical navigation uses the selected Clear Windows direction:
Manrope 600, squared rows, a leading selected accent, theme-aware focus (ink by day, amber at night), directional arrows and
a 25vw desktop rail (26vw at intermediate widths). Existing category labels,
clean URLs, Connect/Give, logo, scenery and content are retained. Historical
prototype route labels and venue copy are not a production source.

Below 700px, the same sidebar moves into a native left-edge modal drawer,
min(336px,90vw), with a dark backdrop. Opening slides horizontally in 180ms;
closing takes 150ms. A new intent cancels the prior animation from its current
transform. Epoch checks prevent stale completions. Reduced motion settles
immediately, including when the preference changes while opening or closing.

The modal locks the source document without losing scroll or preexisting body
styles/inert state. Visible controls form the Tab loop. Escape, Close and backdrop
dismissal restore the initiating focus. Crossing the breakpoint transfers focus
to visible navigation or Menu. Only unmodified same-origin navigation is handled;
modified/new-tab links retain native behavior.

History pushes one temporary same-URL entry with a versioned, bounded scroll-position and original auto/manual policy hint. Back dismisses
the drawer; Forward can reopen it. Repeated close requests cannot traverse twice.
A route selected in the drawer first consumes its overlay entry, then follows the
canonical URL. Pagehide cleans up the modal so a native Back return is usable.
Reload and native page restoration reconcile the marker with modal ownership.
Automatic restoration waits for the scene loader to reveal the page before
focusing Close, and cancels that focus retry after user input.
No content, question draft, response or credential is stored in the overlay hint.

The source social strip and icon-only settings gear follow COMPOSER-CONTROLS.md.
All three existing appearance modes and advanced scene controls remain supported.
The font is bundled locally under OFL; no remote runtime font request is added.

Cloud Linux evidence uses synthetic source records and real Chromium input,
including interrupted/repeated close, Tab, Escape, backdrop, Back/Forward,
navigation, resizing, reduced motion and settings transitions. PNGs, recordings
and per-frame transforms are retained separately. Physical-device frame pacing
and virtual keyboards are not certified by headless recordings.
