# Initial arch reveal

This change replaces only the initial loading cover. It uses the existing
`church-vertical-canva.png` bytes and the reviewed refined arch renderer.
No content, menu, composer, seasonal artwork, source records or provider logic
is changed.

The authentic logo is visible immediately on a white cover. After the current
seasonal stack is decoded by the existing application, a 1,260 ms reveal opens
onto that actual scene. The aperture begins at 100 ms. The complete wordmark fades
from 100–240 ms before the expanding aperture reaches the lettering. A smooth
progression drives logarithmic scale growth to the viewport-fitting arch. The
scene's temporary 8px/1.028 transform returns exactly to its prior inline value.
The canvas backing scale is capped at 2 and rounded to physical pixels.

The existing page becomes visible at completion. This does not introduce the
private prototype's hero or any additional entrance animation. Direct detail
loads reveal their requested page. Same-origin navigation and Back/Forward skip
the authored intro; native bfcache returns retain the already completed document.
Reloads run the initial reveal. No cross-document state is stored.

Reduced motion releases the ready page without animated movement or minimum
delay. Scene load failure preserves the existing neutral fallback/retry controls.
Logo decoding is bounded to 5 seconds; frame/resize exceptions release the page; a 1,910 ms
animation watchdog handles stalled frames. A separate 35 second guard covers failure to
receive the app's bounded scene result. None of these paths sends a request,
submits a question or changes a destination.

`tests/preloader-rendered.mjs` runs only in cloud Linux, with local synthetic
Worker fixtures. It records actual desktop/intermediate/mobile sequences and
checks readiness, direct/internal navigation, Back, reduced motion, image failure,
canvas failure and the frame watchdog. These are not authenticated-live or
physical-device performance claims.
