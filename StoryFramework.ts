/****
 * Example code for ourworldindata - Danijel Beljan
 * dnlbln.com
 * danijel.beljan@protonmail.com
 *
 * This is a small framework I wrote that was used internally at addendum to create interactive stories.
 *
 * The philosophy was to keep it small and simple and have the basic functionality that each story needs:
 * - interaction
 * - tracking
 * - managing progress of story beats (as I call them)
 *
 * The total line length is including comments about 1029, and you will notice that I generally tend to comment
 * quite a lot. Without comments the actual code size is reduced about 20% to 800 lines which makes for quite a compact
 * little framework that is flexible and handles all the basic needs.
 *
 * Notes:
 *     I usually get the question: "Why not React/Vue/Anguler/<insert front-end framework here>?""
 *
 *     "Good question!"
 *
 *     to which I reply:
 *
 *     "Front-end frameworks are generally designed with developing large front-ends in mind, not small little tools (although of course you could use them for small tools as well)."
 *     "I did not want to have the overhead of keeping up with a framework that potentially can go out of date/fashion for a small project."
 *     "Writing in Javascrypt/Typescript keeps the barrier of entry to vanilla should other developers need to work on it."
 */
/// <reference path="../common/interfaces/StoryFramework.interfaces.d.ts" />

import './css/addendumOverrides.css';
import './css/scrollIcon.css';
import './css/StoryFramework.css';

// Small assets are directly embedded using webpack so we don't have to worry about remote assets.
// filesize is negligble here after compression and gzip.
import pressIcon from './icons/press.svg';
import swipeLeftIcon from './icons/swipe-left.svg';
import swipeRightIcon from './icons/swipe-right.svg';
import addLogoLetterA from './icons/add-logo-letter-a.svg';
import addLogoDot from './icons/add-logo-dot.svg';

import Hammer from 'hammerjs'; // framework for standardized swipe capibilities.
import debounce from 'debounce';
import merge from 'lodash.merge';
import { formatDefaultLocale } from 'd3-format';

/**
 * Base story class.
 */
export default class StoryFramework {
    // Order everything alphabteically.
    $: jQuery;

    assetLocation: string;
    controlsDisabled: boolean;
    controlsHelpScreenShown: boolean;
    customSettings: IdefaultSettings;
    currentState: any;
    currentStoryBeatId: string;
    currentStoryBeatIndex: number;
    debug: boolean;
    defaultSettings: IdefaultSettings;
    deploymentPath: string;
    forceManualControl: boolean;
    holder: JQuery;
    holderSelector: string;
    hooks: iHooks;
    initialized: boolean;
    numberFormatter: Inumberformatter;
    onPauseTimestamp: null|number;
    paused: boolean;
    projectPrefix: string;
    remoteAssetLocation: string;
    storyBeatIntervalId: undefined|number;
    storyEnded: boolean;
    storyStarted: boolean;
    trackingId: string;
    settings: IdefaultSettings;
    storyBeats: Map<string, Record<string, unknown>>;

    constructor(projectPrefix: string, trackingId: string, remoteAssetLocation: string, holderSelector: string, customSettings: IdefaultSettings = {}) {
        // jQuery is part of the base dependencies on the addendum website so we can be sure it will exist.
        // I prefer to store it in a property so I know we are actively using it as a part of the class instead as a global.
        this.$ = $;

        // Are we in debug mode?
        this.debug = false;

        // Special prefix used for css classes in order to avoid conflicts with other css on the page.
        this.projectPrefix = projectPrefix;

        // Should be unique compared to any other project We generally use the following format: yyyy-projectname
        this.trackingId = trackingId;

        // What is the url for our assets that are not compiled but loaded remotely ?
        // Having it settable gives us the flexibility to change hosting.
        this.remoteAssetLocation = remoteAssetLocation;

        // Selector of the holder for this story.
        this.holderSelector = holderSelector;

        // jQuery selection of the holder.
        this.holder = this.$(holderSelector);

        /**
         * @type {Object}
         */
        this.defaultSettings = {
            beatIndicators: {
                theme: 'grey' // 'grey' | 'white' | 'black'
            },

            restartBtn: {
                label: 'Restart',
                theme: 'grey' // 'grey' | 'white' | 'black'
            },
            endStory: {
                endStoryOnLastBeat: true,

                /**
                 * Can be the beat id or the index.
                 * @type {Number|String}
                 */
                restartOnBeat: 0,
                showRestartBtn: false,
                restartBtnFadeDuration: 1000, // ms.
                hideScrollDownCursorOnRestart: true,
                showScrollDownCursor: true,

                scrollToContent: false,
                scrollTop: () => window.innerHeight * 0.75,
                scrollDuration: 1000,
                timeoutBeforeScrollToContent: 3000,
            },

            scrollDownIcon: {
                label: 'Read more',
                theme: 'grey' // 'grey' | 'white' | 'black'
            },

            story: {
                startingBeat: 0,
                auto: true,
                forceManualAfterBeat: 0, // 0-based indexing
                timePerBeat: 8000 // In milliseconds. Null for no timer.
            },

            resizeDebounceTiming: 500,

            parameterizedCmsText: {
                /**
                 * You can add a callback function that will return the dataset.
                 * We need this because sometimes some datasets get loaded dynamicall
                 * and do not exist on init time.
                 *
                 * @type {Array.<Function|Object>}
                 */
                datasets: [],
                highlightReplacedText: true,
                highlightBgColor: '#3a7bd5',
                highlightTextColor: '#FFF'
            },

            controls: {
                clickThroughIconOverlay: false,
                showIconOverlays: true,

                // Divide the screen up for the backward and
                // forward beat event. The value will give
                // the backward event 0.33 of the screen to listen to
                // the click event. The rest of the screen is for the
                // forward event.
                // In percent.
                screenRatioBackwardToForward: 33.33
            }
        };

        // Final settings.
        this.settings = merge(this.defaultSettings, customSettings);

        // Map of each storybeat with the value being the state object for that beat.
        this.storyBeats = new Map();

        /**
         * Reference to the current state, beat index and beat id.
         */
        this.currentState = {};
        this.currentStoryBeatIndex = 0;
        this.currentStoryBeatId = '';

        // if true the user will always be forced to tap/click to move the story forward.
        this.forceManualControl = false;

        /**
         * Is the automatic timer paused?
         * The timer pauses on a holding press.
         */
        this.paused = false;
        this.onPauseTimestamp = 0;

        /**
         * Flags.
         */
        this.controlsDisabled = false;
        this.initialized = false;
        this.storyEnded = false;
        this.storyStarted = false;
        this.controlsHelpScreenShown = false;

        /**
         * Id of the interval that counts the elapsed
         * time of timed story beats.
         */
        this.storyBeatIntervalId = undefined;

        /**
         * Hooks are bound to a specific function.
         * Not every function in the framework runs hooks yet.
         * I will extend the framework only when it is needed.
         */
        this.hooks = {};

        /**
         * Create the number formatter.
         */
        const d3FormatObject: d3.FormatLocaleObject = formatDefaultLocale({
            decimal: ",",
            thousands: ".",
            grouping: [3],
            currency: ["", "\u00a0€"]
        });

        this.numberFormatter = {
            default: d3FormatObject.format(','),
            d3formatter: d3FormatObject // provide the raw formatted in case we dynamically want to create new formatters.
        };
    }

    init(): void {
        this.holder = this.$(this.holderSelector);

        // Check if we have a custom asset location set.
        if (this.holder.data('asset-location')) {
            this.assetLocation = this.holder.data('asset-location');
        } else if (this.onLocalHost() === true) {
            this.assetLocation = 'http://' + window.location.host + '/dist/';
        } else {
            this.assetLocation = this.remoteAssetLocation;
        }

        /**
         * Mark the holder with our framework css classes in order to apply styling.
         */
        this.holder.addClass(`${this.projectPrefix}-story-holder add-ds-holder`);

        // First add the app html.
        this.holder.append(this.getAppHtml());

        // Activate loading screen.
        this.showloader(1);

        // Create the story beat indicators.
        this.initStoryBeatIndicators();

        // Must come at the end because binding events is generally dependant on having the elements exist in the DOM beforehand.
        this.bindEvents();

        // Run the debug setter so it applies all kinds of changes.
        this.setDebug(this.debug);

        // Flag we are done initializing.
        this.initialized = true;
    }

    initStoryBeatIndicators(): void {
        const storyBeatIndicatorHolder = this.holder.find('.add-ds-beat-indicators');

        const wgIndicatorHolderWidth = parseInt(storyBeatIndicatorHolder.css('width'), 10) - 20;
        const widthPerIndicator = wgIndicatorHolderWidth / this.storyBeats.size;
        let indicatorHtml = '';

        let counter = 0;
        this.storyBeats.forEach(() => {
            let currentBeatWidth = 0;
            if (counter <= this.currentStoryBeatIndex) {
                currentBeatWidth = 100;
            }

            indicatorHtml += this.createStoryBeatIndicatorHtml(widthPerIndicator, currentBeatWidth);

            counter++;
        });

        storyBeatIndicatorHolder.html(indicatorHtml);
    }

    hideWebsiteMenu(): void {
        this.$('header').hide();
    }

    adaptStylesToOverlayedMenu(): void {
        // adapt the header to be fixed so we don't have mess with heights
        // and the interactive container will fill the screen.
        this.$('header').css({
            position: 'fixed',
            'z-index': '10'
        });

        // Add some padding so the beat Indicatiors have some spacing between the menu.
        this.$('header .main-bar').css({
            'transition': 'none',
            'padding-top': '5px',
            'background': 'none'
        });
    }

    adaptStoryHolderToShownMenu(): void {
        let height = window.innerHeight;
        const menuHeight = this.$('header').height() || 0;
        height -= menuHeight;

        this.$('.interactive-container').height(height);
    }

    createStoryBeatIndicatorHtml(widthPerIndicator: number, currentBeatWidth: number): string {
        const theme = this.settings.beatIndicators.theme;

        return `
            <div class="add-ds-beat-indicator add-ds-beat-indicator-${theme}" style="width: ${widthPerIndicator}px">
                <div class="add-ds-ind-bg"></div>
                <div class="add-ds-ind-time" style="width: ${currentBeatWidth}%"></div>
            </div>
        `;
    }

    startStory(): void {
        this.trackAction('start story');

        this.hideLoader();

        const startingBeat = this.settings.story.startingBeat;

        if (typeof startingBeat === 'number' && startingBeat > -1 && startingBeat < this.storyBeats.size) {
            this.showBeat(startingBeat);
        } else {
            this.showBeat(0);
        }

        this.storyStarted = true;
    }

    endStory(): void {
        // Remove this class in case it was added by the cms.
        this.$('body').removeClass('no-scroll');

        if (this.settings.endStory.showScrollDownCursor === true) {
            this.showScrollDownCursor();
        } else {
            this.hideScrollDownCursor();
        }

        if (this.settings.endStory.showRestartBtn === true) {
            this.showRestartBtn();
        } else {
            this.hideRestartBtn();
        }

        if (this.settings.endStory.scrollToContent === true) {
            let top;
            const scrollDuration = this.settings.endStory.scrollDuration;

            if (typeof this.settings.endStory.scrollTop === 'function') {
                top = this.settings.endStory.scrollTop();
            } else {
                top = this.settings.endStory.scrollTop;
            }

            setTimeout(this.scrollTop.bind(this, top, scrollDuration), this.settings.endStory.timeoutBeforeScrollToContent);
        }

        this.storyEnded = true;
    }

    pause(): void {
        this.paused = true;
        this.onPauseTimestamp = Date.now();
    }

    unpause(): void {
        this.paused = false;
        this.onPauseTimestamp = null;
    }

    // Todo rename this on longPress.
    isBeatPause(): boolean {
        // If there is no timestamp the story was not in pause so no hold is taking place.
        if (this.onPauseTimestamp === null) return false;

        const delta = Date.now() - this.onPauseTimestamp;

        // If the user held the pause
        // for longer than 250ms we
        // will treat it as a hold.
        if (delta > 250) {
            return true;
        }

        return false;
    }

    bindEvents(): void {
        const vm = this;
        const swipeController = new Hammer(this.holder[0]);

        /**
         * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
         * Because of this global click listener on the holder
         * you must run stopPropagation() on any handler that does
         * any kind of click/mouse event otherwise you will always
         * trigger a beat move.
         *
         * The reason there is a global click is so I don't have to create empty divs overlaying the entire story
         * just to capture a click event. Having them during development is extremely annoying if I need to inspect
         * elements because it is always blocking it so we opted for this solution.
         * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

         * Listening to the click event on the holder.
         * Depending where you click it will either
         * move the story backward or forward.
         */
        this.holder.on('click', evt => {
            if (this.controlsDisabled === true) return;

            vm.hideAllControlsHelp();

            const oEvent = <MouseEvent>evt.originalEvent; // Cast to fix useless warning by TS.
            const x: number = oEvent.clientX;
            const holderWidth: number = <number>this.holder.width();
            const relativeX: number = x / holderWidth * 100;

            // When the story is not set to auto there is nothing
            // to pause so we always allow the event.
            if (this.settings.story.auto === false || this.isBeatPause() === false) {
                if (relativeX > this.settings.controls.screenRatioBackwardToForward) {
                    this.nextBeat();
                } else {
                    this.previousBeat();
                }
            }

            // Always call unpause the story gets unpaused.
            // Must come last.
            this.unpause();

            // No need to show help screen if user already knows what to do.
            vm.controlsHelpScreenShown = true;
        });

        // Pause control.
        this.holder.on('mousedown touchstart', evt => {
            // This event must be blocked so the story does not get paused when
            // there are no obvious controls active.
            if (this.controlsDisabled === true) return;

            // Stop propagation so the event does not bubble up and trigger a move beat function.
            evt.stopPropagation();
            this.pause();
        });

        // Setup swipe controls.
        swipeController.on('swipe', function swipeHandler(evt) {
            if (vm.controlsDisabled === true) return;

            vm.hideAllControlsHelp();

            switch (evt.direction) {
                // Left.
                case 2:
                    vm.nextBeat();
                    break;

                // Right.
                case 4:
                    vm.previousBeat();
                    break;

                // Up.
                case 8:
                    vm.nextBeat();
                    break;

                // Down.
                case 16:
                    vm.previousBeat();
                    break;

                default:
                    break;
            }
        });

        window.addEventListener('resize', debounce(this.resize.bind(this), this.settings.resizeDebounceTiming));

        // Restart btn.
        this.holder.find('.add-ds-restart-btn').click(evt => {
            // Stop propagation so the event does not bubble up and trigger a move beat function.
            evt.stopPropagation();
            this.restart();
        });

        this.holder.find('.add-ds-scroll-down-icon').on('click', evt => {
            // Stop propagation so the event does not bubble up and trigger a move beat function.
            evt.stopPropagation();
            this.scrollToContentStart();
        });

        this.holder.find('.add-ds-mobile-controls-help, .add-ds-desktop-controls-help').on('click', evt => {
            // Stop propagation so the event does not bubble up and trigger a move beat function.
            evt.stopPropagation();
            this.hideAllControlsHelp();
        });

        this.runHooks('bindEvents');
    }

    resize() {
        // Resize the holder before doing anything else.
        if (this.settings.layout.websiteMenu === 'shown') {
            this.adaptStoryHolderToShownMenu();
        }

        // reinit the indicators or they will
        // be sized incorrectly.
        this.initStoryBeatIndicators();
    }

    scrollTop(top, duration): void {
        const body = this.$('html, body');

        body.stop().animate({
            scrollTop: top
        }, duration);
    }

    scrollToContentStart(): void {
        const body = this.$('html, body');

        body.stop().animate({
            scrollTop: window.innerHeight * 0.75
        }, 750);
    }

    previousBeat(step = 1): void {
        if (this.currentStoryBeatIndex > 0) {
            const index = this.currentStoryBeatIndex - step;

            if (this.shouldBeatBeSkipped(index) === true) {
                this.previousBeat(++step);
            } else {
                this.showBeat(index);
            }
        }
    }

    nextBeat(step = 1): void {
        // Only go forward if stay under the limit.
        if (this.currentStoryBeatIndex < this.storyBeats.size - 1) {
            const index = this.currentStoryBeatIndex + step;

            if (this.shouldBeatBeSkipped(index) === true) {
                this.nextBeat(++step);
            } else {
                this.showBeat(index);

                // If we reach the last beat and we should end the story
                // we will run endStory().
                if (index === this.storyBeats.size - 1 && this.settings.endStory.endStoryOnLastBeat === true) {
                    this.endStory();
                }
            }
        }
    }

    shouldBeatBeSkipped(index): boolean {
        const beatKeys = [...this.storyBeats.keys()];
        const state = <any>this.storyBeats.get(beatKeys[index]);

        return state.skip ?? false;
    }

    showloader(opacity = 1): void {
        this.holder.find('.add-ds-loader-holder').animate({
            'opacity': opacity
        }, 1000);
    }

    hideLoader(fadeOutTime = 1000): void {
        const $loader = this.holder.find('.add-ds-loader-holder');

        if (fadeOutTime === 0) {
            $loader.hide();
        } else {
            $loader.fadeOut(fadeOutTime);
        }
    }

    addHook(functionName: string, callback: () => void) {
        if (typeof this[functionName] === 'function') {
            if (this.hooks[functionName] === undefined) {
                this.hooks[functionName] = [callback];
            } else {
                this.hooks[functionName].push(callback);
            }
        } else {
            console.error(`Cannot add hook to ${functionName}() because it does not exist on the story framework.`);
        }
    }

    /**
     * Run hooks for a specific id.
     */
    runHooks(id: string): void {
        if (this.hooks[id]) {
            for (let i = 0; i < this.hooks[id].length; i++) {
                this.hooks[id][i]();
            }
        }
    }

    /**
     * Creates the correct url to the asset.
     * Url must be without starting /
     */
    createAssetUrl(url: string): string {
        // If it's a base64 string just return the data.
        if (url.search('base64') !== -1) {
            return url;
        }

        return this.assetLocation + url;
    }

    showScrollDownCursor(): void {
        this.holder.find('.add-ds-scroll-down-icon').stop(true).fadeIn();
    }

    hideScrollDownCursor(): void {
        this.holder.find('.add-ds-scroll-down-icon').stop(true).fadeOut();
    }

    enableControls(): void {
        this.controlsDisabled = false;

        this.holder.find('.add-ds-beat-indicators').css('opacity', 1);

        if (this.settings.controls.showIconOverlays === true) {
            this.holder.find('.add-ds-beat-control-icon-overlays').show();
        }
    }

    disableControls(): void {
        this.controlsDisabled = true;

        this.holder.find('.add-ds-beat-indicators').css('opacity', 0);
        this.holder.find('.add-ds-beat-control-icon-overlays').hide();
    }

    hideAllControlsHelp(): void {
        this.holder.find('.add-ds-mobile-controls-help').fadeOut();
        this.holder.find('.add-ds-desktop-controls-help').fadeOut();
    }

    hideCMSContent(): void {
        this.$('#page-content').hide();
        this.$('footer').hide();

        // Reset scroll top or otherwise
        // on when we reshow the scrolltop will be messed up.
        const body = this.$('html, body');
        body.stop().animate({
            scrollTop: 0
        }, 0);
    }

    isTouchCapable(): boolean {
        return 'ontouchstart' in window
            || (window.DocumentTouch && document instanceof window.DocumentTouch)
            || navigator.maxTouchPoints > 0
            || window.navigator.msMaxTouchPoints > 0;
    }

    showControlsHelpScreen(): void {
        this.controlsHelpScreenShown = true;

        if (this.isTouchCapable()) {
            this.holder.find('.add-ds-mobile-controls-help').stop(true).fadeIn();
        } else {
            this.holder.find('.add-ds-desktop-controls-help').stop(true).fadeIn();
        }
    }

    /**
     * Runs before the actual showBeat() is executed
     * so you can hook into it.
     */
    preShowBeat(beatId: string, beatIndex: number): void {

    }

    /**
     * @param {Number|String} beatId Can be the index of the beat or the actual id.
     */
    showBeat(beatId): void {
        let beatIndex;
        const beatKeys = [...this.storyBeats.keys()];

        if (typeof beatId === 'string') {
            beatIndex = beatKeys.indexOf(beatId);

            if (beatIndex === -1) {
                console.error(`${beatId} - Beat id not found.`);
                return;
            }
        } else if (typeof beatId === 'number') {
            beatIndex = beatId;
        } else {
            console.error('Invalid beat id passed. Must be an number (index) or string (beat id).');
            return;
        }

        this.trackAction('show beat - ' + beatKeys[beatIndex]);

        // Run a function users can hook into to run code
        // before the actual showBeat is run.
        this.preShowBeat(beatKeys[beatIndex], beatIndex);

        this.setState(
            this.storyBeats.get(beatKeys[beatIndex]),
            beatKeys[beatIndex],
            beatIndex
        );

        for (let i = 0; i < this.storyBeats.size; i++) {
            let width = 100;
            if (i >= beatIndex) {
                width = 0;
            }
            this.setBeatIndicatorWidth(i, width);
        }

        // Clear out any outstanding interval before proceeding.
        clearInterval(this.storyBeatIntervalId);

        if (this.settings.story.auto === true && this.forceManualControl === false) {
            let timeElapsed = 0;
            const updateInterval = 15;

            // Force manual control after this point.
            if (beatIndex === this.settings.story.forceManualAfterBeat) {
                this.forceManualControl = true;
            }

            // Interval that updates the progress bar.
            this.storyBeatIntervalId = window.setInterval(() => {
                if (this.paused !== true) {
                    timeElapsed += updateInterval;

                    let progress = timeElapsed / this.settings.story.timePerBeat * 100;

                    // When we reach the full width of the indicator this beat is over
                    // and we clear the interval.
                    if (progress >= 100) {
                        progress = 100;
                        clearInterval(this.storyBeatIntervalId);

                        if (this.forceManualControl === false) {
                            this.nextBeat();
                        } else if (this.controlsHelpScreenShown === false) {
                            this.showControlsHelpScreen();
                        }
                    }

                    this.setBeatIndicatorWidth(beatIndex, progress);
                }
            }, updateInterval);
        } else {
            // Color in the beat indicator.
            this.setBeatIndicatorWidth(beatIndex, 100);
        }
    }

    addBeat(id: string, state: any): void {
        if (this.storyBeats.has(id) === true) {
            throw 'Duplicate story beat entry found.';
        }

        this.storyBeats.set(id, state);
    }

    setBeatIndicatorWidth(beatIndex: number, width: number): void {
        this.holder.find(`.add-ds-beat-indicator:nth-child(${beatIndex + 1})`)
            .find('.add-ds-ind-time').css('width', `${width}%`);
    }

    /**
     * Override when necessary. You will most
     * likely do this for each project since you
     * will have new elements you want to control.
     */
    setState(state: any, beatId: string, beatIndex: number): void {
        this.currentStoryBeatIndex = beatIndex;
        this.currentStoryBeatId = beatId;
        this.currentState = state;

        if (state.disableControls === true) {
            this.disableControls();
        } else if (state.disableControls === false) {
            this.enableControls();
        }
    }

    /**
     * Log an action in our tracker.
     */
    trackAction(action: string): void {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'qvv_data_event',
                action: this.trackingId,
                label: action
            });
        }
    }

    onLocalHost(): boolean {
        if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
            return true;
        }

        return false;
    }

    find(idenitifer): jQuery {
        return this.holder.find(`.${this.projectPrefix}-${idenitifer}`);
    }

    /**
     * Restarts the story to the selected beat.
     * Also runs reset which should be defined by parent class.
     */
    restart(): void {
        this.hideRestartBtn();

        if (this.settings.endStory.hideScrollDownCursorOnRestart === true) {
            this.hideScrollDownCursor();
        }

        this.reset();

        this.showBeat(this.settings.endStory.restartOnBeat);
    }

    showRestartBtn(): void {
        this.holder.find('.add-ds-restart-btn').fadeIn(this.settings.endStory.restartBtnFadeDuration);
    }

    hideRestartBtn(): void {
        this.holder.find('.add-ds-restart-btn').fadeOut(this.settings.endStory.restartBtnFadeDuration);
    }

    /**
     * Html.
     */

    getAppHtml(): string {
        let html = `
            <div class="add-ds-beat-indicators"></div>

            ${this.getAppSpecificHtml(this.projectPrefix)}

            ${this.getRestartButtonHtml()}

            ${this.getScrollDownIconHtml()}

            ${this.getControlsHelpHtml(this.settings.controls.clickThroughIconOverlay)}

            ${this.getLoaderHtml()}
        `;

        if (this.settings.controls.showIconOverlays === true) {
            html += this.getBeatControlsIconOverlays();
        }

        return html;
    }

    /**
     * Put the HTML unqiue to this project here;
     *
     * Don't forget to use the class specific prefix
     * with ${projectPrefix}
     */
    getAppSpecificHtml(projectPrefix: string): string {
        return `
            <div class="add-ds-no-app-html">
                Please override getAppSpecificHtml() and write your own custom app html there.
            </div>
        `;
    }

    getRestartButtonHtml(): string {
        const label = this.settings.restartBtn.label;
        const theme: string = this.settings.restartBtn.theme;

        return `
            <button class="add-ds-restart-btn add-ds-restart-btn-${theme}">
                ${label}
            </button>
        `;
    }

    getScrollDownIconHtml(): string {
        const label: string = this.settings.scrollDownIcon.label;
        const theme: string = this.settings.scrollDownIcon.theme;

        return `
            <div class="add-ds-scroll-down-icon add-ds-scroll-down-icon-${theme}">
                <div class="chevron"></div>
                <div class="chevron"></div>
                <div class="chevron"></div>
                <span class="text">${label}</span>
            </div>
        `;
    }

    getControlsHelpHtml(clickThroughIconOverlay = false): string {
        const tapLeftWidth = this.settings.controls.screenRatioBackwardToForward;
        const tapRightWidth = 100 - this.settings.controls.screenRatioBackwardToForward;

        const styles: string[] = [];

        if (clickThroughIconOverlay === true) {
            styles.push('pointer-events: none');
        }

        return `
            <div class="add-ds-mobile-controls-help" style="${styles.join(';')}">
                <div class="add-ds-swipe-left">
                    <img src="${swipeLeftIcon}"/>
                    <div>Weiter</div>
                </div>

                <div class="add-ds-swipe-right">
                    <img src="${swipeRightIcon}"/>
                    <div>Zurück</div>
                </div>
            </div>

            <div class="add-ds-desktop-controls-help" style="${styles.join(';')}">
                <div class="add-ds-tap-left" style="width: ${tapLeftWidth}%">
                    <img src="${pressIcon}"/>
                    <div>Zurück</div>
                </div>

                <div class="add-ds-tap-right" style="width: ${tapRightWidth}%">
                    <img src="${pressIcon}"/>
                    <div>Weiter</div>
                </div>
            </div>
        `;
    }

    getLoaderHtml(): string {
        return `
            <div class="add-ds-loader-holder">
                <div class="add-ds-loader-overlay"></div>

                ${this.getLoaderCircleHtml()}
            </div>
        `;
    }

    getLoaderCircleHtml(): string {
        return `
            <div class="add-ds-loader">
                <img src="${addLogoLetterA}"/>
                <img src="${addLogoDot}" class="loader-circle loader-circle-1"/>
                <img src="${addLogoDot}" class="loader-circle loader-circle-2"/>
            </div>
        `;
    }

    /**
     * This html doesn't have events. It is just for visual visual for the user.
     */
    getBeatControlsIconOverlays(): string {
        const tapLeftWidth = this.settings.controls.screenRatioBackwardToForward;
        const tapRightWidth = 100 - this.settings.controls.screenRatioBackwardToForward;

        return `
            <div class="add-ds-beat-control-icon-overlays">
                <div class="add-ds-beat-control-icon-back" style="width: ${tapLeftWidth}%"></div>
                <div class="add-ds-beat-control-icon-forward" style="width: ${tapRightWidth}%"></div>
            </div>
        `;
    }

    /**
     * Override this per project and decide what to do.
     */
    reset() {

    }

    setDebug(debug: boolean): void {
        this.debug = debug;

        if (this.debug === false) {
            this.holder.removeClass('debug');
        } else {
            this.holder.addClass('debug');
        }
    }

    toggleDebug(): void {
        this.setDebug(!this.debug);
    }
}
