# Publication audit — incomplete approval checklist

## Checks completed on exported text

- No email addresses found in HTML/JS/CSS/SVG.
- No localStorage/sessionStorage, network fetch/XHR/beacon or analytics code in the preserved UI.
- Composer text is held in the page only; submission announces that nothing was sent.
- Only appearance preference cookie is written; review privacy notice requirements before public launch.
- Text is explicitly illustrative. No verified service times, address, member stories or operational claims are added.
- External hyperlink found: official Seoul Tower color guide. SVG namespace is not a data destination.
- No Git history, original internal artwork notes, connected-app project metadata, credentials, member/donor/prayer records, or unrelated workspace material included.
- Wrangler 4.152.0 is pinned as a development tool and installed from the official npm registry with lifecycle scripts disabled. Automated content scan is a limited check, not a guarantee of legal clearance or comprehensive secret detection.

## Requires human/publication review

- Confirm each artwork asset may be published and reused; generated variants and `church-vertical-canva.png` provenance/license are NOT reverified here. No blanket open-source or artwork license is asserted.
- Review rendered images for unintended personal information, logos and sensitive detail. This preparation did not perform new pixel-by-pixel image review.
- Approve church brand use and all illustrative copy. Keep prototype labels on staging/next.
- The public `freedomvillage/website` repository is approved. Source and downloadable artwork will be public even if staging uses Access.
- Repository protection and staff permissions must be verified for the chosen GitHub plan.
- Headers include noindex for both environments. Remove only as part of a separately approved real launch; noindex does not restrict access.
- Current 2–3 MB seasonal PNGs should be optimized before mobile public launch. All season triples remain intact, including dynamically named assets.
- No automated deploy workflow or account/DNS binding is supplied. Approved scope is only the new staging and next deployment; apex/www/Webflow must remain unchanged.
