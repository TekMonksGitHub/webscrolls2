/**
 * Init and run the app. 
 * (C) 2024 TekMonks. All rights reserved.
 * See enclosed LICENSE file.
 */

_init();
async function _init() {
    const debug_mode = true;
    const html_overlay = `
        <style>
        .overlay {
        background: #fff;
        position: fixed;
        bottom: 0;
        right: 0;
        left: 0;
        top: 0;
        }
        .loading {
        position: absolute;
        top: 50%;
        left: 50%;
        }
        .loading-bar {
        display: inline-block;
        width: 4px;
        height: 18px;
        border-radius: 4px;
        animation: loading 1s ease-in-out infinite;
        }
        .loading-bar:nth-child(1) {background-color: #3498db; animation-delay: 0;}
        .loading-bar:nth-child(2) {background-color: #c0392b; animation-delay: 0.09s;}
        .loading-bar:nth-child(3) {background-color: #f1c40f; animation-delay: .18s;}
        .loading-bar:nth-child(4) {background-color: #27ae60; animation-delay: .27s;}

        @keyframes loading {
        0% {transform: scale(1);}
        20% {transform: scale(1, 2.2);}
        40% {transform: scale(1);}
        }
        </style>
        <div class="overlay">
        <div class="loading">
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
        </div>
        </div>
    `

    await import("/framework/js/$$.js"); 
    if (!$$.isDualBoot()) {
        document.head.insertAdjacentHTML("afterend", html_overlay);
        const WEBSCROLLS_CONSTANTS = (await import ("./constants.mjs")).WEBSCROLLS_CONSTANTS;
        const appPath = `${window.location.protocol}//${window.location.host}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}`;
        const confPath = `${window.location.protocol}//${window.location.host}/apps/${WEBSCROLLS_CONSTANTS.APP_NAME}/conf`;
        $$.boot(new URL(appPath), new URL(confPath), !debug_mode, true); // now boot the app
    }
}
