var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    moment = require('moment'),
    Pace = require('pace'),
    glob = require('glob');

/**
 * @class SeleniumRunner
 *
 * SeleniumRunner is a wrapper around the "wd-sync" library, which you can learn more
 * about here:
 *
 * https://github.com/sebv/node-wd-sync
 *
 * Wd-sync uses the "node-fibers" library to execute Selenium tests in a synchronous
 * manner, allowing the developer to quickly create tests without all of the extra
 * ceremony required by chained methods, etc...
 */
var SeleniumRunner = function() {
    this.init.apply(this, arguments);
};

_.extend(SeleniumRunner.prototype, {

    'init': function(options) {
        this._parseOptions(options);
        this._pluginNames = [];
        this._plugins = {};
        this._loadPlugins();
        this._loadPlugins(__dirname + '/plugins');
    },

    '_parseOptions': function(options) {
        options = options || {};
        this._options = options;
    },

    '_loadPlugins': function(dir) {
        var pluginFiles = this._getPluginFiles(dir),
            wd = require('./node_modules/wd-sync/node_modules/wd/lib/main');
        global.wd = wd;
        _.each(pluginFiles, function(plugin) {
            plugin = require(plugin);
            if (this._pluginNames.indexOf(plugin.name) >= 0) {
                return;
            }
            this._pluginNames.push(plugin.name);
            this._plugins[plugin.name] = plugin.fn;
            wd.addAsyncMethod(plugin.name, plugin.fn);
        }, this);
    },

    /**
     * Runs defined Selenium tests.
     *
     * @param {String} runType - The test suite to be run.
     * @param {String} soloTest - Optional. The name of a single, specific test to be run.
     * @param {Boolean} debug - Optional. Defaults to true. Whether or not to log test results to the console as they are ready.
     * @param {Function} fn - Callback function to be called once the test run is complete.
     */
    'run': function(runType, soloTest, fn) {

        this._options.debug = false;

        if (_.isFunction(soloTest)) {
            fn = soloTest;
            soloTest = null;
        }

        var start_ts = moment().unix();

        var wdSync = require('wd-sync'),
            runOptions = this._options[runType],
            steps = this._getTestFiles(),
            self = this,
            results = {};

        this._log('Running tests with environment `' + runType + '` at url: ' + runOptions.url);

        var _other = [];
        _.each(steps, function(v, k) {
            if (k === 'suites') {
                return;
            }
            _other.push(v);
            delete steps[k];
        });
        steps.suites._other = _other;

        var totalTestCount = 0,
            totalBrowserCount = 0;
        _.each(runOptions.browsers, function(browserSettings) {
            totalBrowserCount++;
            _.each(steps.suites, function(suite) {
                _.each(suite.tests, function(step) {
                    totalTestCount++;
                });
            });
        });

        var done = function() {
            var end_ts = moment().unix(),
                diff = end_ts - start_ts,
                elapsed = moment.duration(end_ts - start_ts).humanize();
            var finalResult = {
                'total_tests': totalTestCount,
                'total_browsers': totalBrowserCount,
                'elapsed_time': elapsed,
                'results': results
            };
            if (_.isFunction(fn)) {
                fn(finalResult);
            }
        };

        var pace = Pace(totalTestCount);

        var testCounter = 0;
        _.each(runOptions.browsers, function(browserSettings) {
            // self._log('   Testing with browser: ' + _.values(browserSettings).join(', '));
            _.each(steps.suites, function(suite) {
                _.each(suite.tests, function(step) {
                    var client = wdSync.remote(runOptions.host, runOptions.port, runOptions.username, runOptions.access_key),
                        browser = client.browser,
                        sync = client.sync;
                    _.each(self._plugins, function(fn, name) {
                        browser[name] = function() {
                            return fn.apply(browser, arguments);
                        };
                    });
                    sync(function() {
                        self._processTest(step, runOptions.url, soloTest, results, browser, browserSettings, suite);
                        pace.op();
                        testCounter++;
                        if (testCounter === totalTestCount) {
                            done();
                        }
                    });
                });
            });
        });

    },

    '_processTest': function(step, url, soloTest, results, browser, browserSettings, suite) {
        var test = require(step),
            baseName = path.basename(step).replace('.js', ''),
            entry;
        if (soloTest && baseName !== soloTest) {
            return;
        }
        // this._log('      Running test: ' + baseName);
        browser.init(browserSettings);
        browser.get(url);
        try {
            test(browser);
            // this._log('         Status: Pass'.green);
            entry = {
                'platform': browserSettings.platform || '',
                'browser': browserSettings.browserName || '',
                'browserVersion': browserSettings.browserVersion || '',
                'status': 'pass',
                'message': ''
            };
            var screenshot_filename = entry.browser + '_' + entry.platform + '_' + baseName + '_success.png';
            screenshot_filename = screenshot_filename.replace(' ', '_');
            if (!_.isUndefined(this._options.screenshot_failed_tests) && this._options.screenshot_failed_tests === true && this._options.screenshots_path) {
                browser.saveScreenshot(this._options.screenshots_path + '/' + screenshot_filename);
            }
        } catch(e) {
            var msg = '         Status: Fail - ' + e.message;
            // this._log(msg.red);
            entry = {
                'platform': browserSettings.platform || '',
                'browser': browserSettings.browserName || '',
                'browserVersion': browserSettings.browserVersion || '',
                'status': 'fail',
                'message': e.message
            };
            var screenshot_filename = entry.browser + '_' + entry.platform + '_' + baseName + '_fail.png';
            screenshot_filename = screenshot_filename.replace(' ', '_');
            if (!_.isUndefined(this._options.screenshot_failed_tests) && this._options.screenshot_failed_tests === true && this._options.screenshots_path) {
                browser.saveScreenshot(this._options.screenshots_path + '/' + screenshot_filename);
            }
        }
        if (!results[suite.name]) {
            results[suite.name] = {};
        }
        if (!results[suite.name][baseName]) {
            results[suite.name][baseName] = [];
        }
        results[suite.name][baseName].push(entry);
        browser.quit();
    },

    '_getTestFiles': function() {
        var result = {
            'tests': glob.sync(path.resolve(this._options.test_dir) + '/*Test.js'),
            'suites': this._getTestSuites()
        };
        return result;
    },

    '_getTestSuites': function() {
        var testDir = path.resolve(this._options.test_dir),
            files = fs.readdirSync(testDir),
            suites = [];
        _.each(files, function(file) {
            if (file.indexOf('.') === 0) {
                return;
            }
            if (file === '_other') {
                throw 'The value `_other` cannot be used as a suite name.';
            }
            var suitePath = testDir + '/' + file,
                stat = fs.statSync(suitePath);
            if (stat.isDirectory()) {
                var suite = {
                    'name': path.basename(suitePath),
                    'tests': glob.sync(suitePath + '/*Test.js')
                };
                if (!_.isEmpty(suite.tests)) {
                    suites.push(suite);
                }
            }
        });
        return suites;
    },

    '_getPluginFiles': function(dir) {
        if (dir) {
            dir += '/*.js';
        } else {
            dir = path.resolve(this._options.plugin_dir) + '/*.js';
        }
        return glob.sync(dir);
    },

    '_log': function() {
        var args = _.toArray(arguments);
        if (!this._options.debug || _.isEmpty(args)) {
            return;
        }
        if (args.length === 1) {
            args = args[0];
        }
        console.log(args);
    }

});

module.exports = SeleniumRunner;
