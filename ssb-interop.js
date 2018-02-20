/**
 * The preload script needs to stay in regular ole JavaScript, because it is
 * the point of entry for electron-compile.
 */

require('../stat-cache');

const { init } = require('electron-compile');
const { assignIn } = require('lodash');
const path = require('path');

const { isPrebuilt } = require('../utils/process-helpers');
const profiler = require('../utils/profiler.js');

if (profiler.shouldProfile()) profiler.startProfiling();

process.on('uncaughtException', (e) => console.error(e));

/**
 * Patch Node.js globals back in, refer to
 * https://electron.atom.io/docs/api/process/#event-loaded.
 */
const processRef = window.process;
process.once('loaded', () => {
  window.process = processRef;
});

/**
 * loadSettings are just the command-line arguments we're concerned with, in
 * this case developer vs production mode.
 */
const loadSettings = window.loadSettings = assignIn({},
  require('electron').remote.getGlobal('loadSettings'),
  { windowType: 'webapp' }
);

const resourcePath = path.join(__dirname, '..', '..');
const mainModule = require.resolve('../ssb/main.ts');
const isDevMode = loadSettings.devMode && isPrebuilt();

init(resourcePath, mainModule, !isDevMode);

// @see https://github.com/widget-/slack-black-theme
// First make sure the wrapper app is loaded
document.addEventListener('DOMContentLoaded', function () {

    // Then get its webviews
    let webviews = document.querySelectorAll('.TeamView webview');

    const development = false;

    const cssPath = development
        ? 'https://raw.githubusercontent.com/MortalFlesh/slack-black-theme/feature/customizations/custom.css'
        : 'https://cdn.rawgit.com/widget-/slack-black-theme/master/custom.css';

    let cssPromise = fetch(cssPath).then(response => response.text());

    let customCustomCSS = `
   :root {
      /* Modify these to change your theme colors: */
      --primary: #09F;
      --text: #CCC;
      --background: #888;
      --background-elevated: #080808;
      --background-hover: rgba(102, 219, 239, 0.1);
   	  --background-light: #D20000;
      --background-bright: #66DBEF;
   }
   `

    // Insert a style tag into the wrapper view
    cssPromise.then(css => {
        let s = document.createElement('style');
        s.type = 'text/css';
        s.innerHTML = css + customCustomCSS;
        document.head.appendChild(s);
    });

    // Wait for each webview to load
    webviews.forEach(webview => {
        webview.addEventListener('ipc-message', message => {
            if (message.channel == 'didFinishLoading')
            // Finally add the CSS into the webview
                cssPromise.then(css => {
                    let script = `
                     let s = document.createElement('style');
                     s.type = 'text/css';
                     s.id = 'slack-custom-css';
                     s.innerHTML = \`${css + customCustomCSS}\`;
                     document.head.appendChild(s);
                     `
                    webview.executeJavaScript(script);
                })
        });
    });

    if (development) {
        // -------- development -------------
        const localCssPath = '/Users/chromecp/www/slack-black-theme/custom.css';

        window.reloadCss = function () {
            const webviews = document.querySelectorAll('.TeamView webview');
            fetch(cssPath + '?zz=' + Date.now(), { cache: 'no-store' }) // qs hack to prevent cache
                .then(response => response.text())
                .then(css => {
                    console.log(css.slice(0, 50));
                    webviews.forEach(webview =>
                        webview.executeJavaScript(`
	               (function() {
	                  let styleElement = document.querySelector('style#slack-custom-css');
	                  styleElement.innerHTML = \`${css}\`;
	               })();
	            `)
                    )
                });
        };

        fs.watchFile(localCssPath, reloadCss);
        // -------- development -------------
    }
});
