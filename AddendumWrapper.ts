/**
 * Example code for ourworldindata - Danijel Beljan
 * dnlbln.com
 * danijel.beljan@protonmail.com
 * This is not just an example of code but more of a philosophy of development/efficiency and 'ease of use'.
 *
 * The goal was to quickly test integration of any story/chart/visualization that we develop against the live website. We did not have a testing team and the development of the website was outsourced so we had no dev access to it.
 * Our only option testing against the actual website would require creating a private post through a very slow wordpress backend CMS, which was then only viewable by going through a 2 step authentication process on EACH device. Extremely cumbersome.
 *
 * Since the website rarely changed fundamentally I decided to download the raw html and strip it in separate parts and write a small helper to inject my story into it.
 * This would allow me to:
 * 1. Immediately test integration locally with almost 100% accuracy as long as I kept the wrapper up to date.
 * 2. Deploy the story with this wrapper and send it to editors/colleagues for approval/testing without having them to go through a cumbersome login procedure.
 * 3. Use browserstack to test integration without having to go through the login procedure when switching devices.
 *
 * The added flexibility and ease of use was incredibly worth it, with a downside of having to keep the wrapper up to date should the website change.
 *
 *
 * Developer Notes:
 * - I could probably do without jQuery but since this is a development only stack and I am very familiar with jQuery
 * and the ease of use, the added 'code size' is not really an issue I feel.
 */
import './css/addendumWrapper/main.css';
import './css/addendumWrapper/app.css';

import navOverlay from './html/addendumWrapper/nav-overlay.js';
import header from './html/addendumWrapper/header.js';
import mainHome from './html/addendumWrapper/main-home.js';
import interactiveContainer from './html/addendumWrapper/interactive-container.js';
import pageContent from './html/addendumWrapper/page-content.js';
import footer from './html/addendumWrapper/footer.js';
import scripts from './html/addendumWrapper/scripts.js';
import StoryFramework from './StoryFramework';

/**
 * A class that will wrap the story in the addendum website html so we
 * have an as accurrate version as possible.
 */
export default class AddendumWrapper {
    /**
     * Wraps the story inside the html of the addendum site.
     *
     * Appends the final html to the body.
     *
     */
    static wrap(story: StoryFramework, parameterizedText = '', scriptsPathPrefix = './'): void {
        const pageContentHtml = pageContent.replace('[parameterizedText]', parameterizedText);

        const scriptsHtml = scripts.replace('[customPathPrefix]', scriptsPathPrefix);

        const html = `
            ${navOverlay}
            ${header}
            ${mainHome}
            ${interactiveContainer}
            ${pageContentHtml}
            ${footer}
            ${scriptsHtml}
        `;

        $('body').append(html);

        story.init();
    }
}
