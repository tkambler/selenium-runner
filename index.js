var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    colors = require('colors'),
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

    'run': function(runType, soloTest, debug, fn) {

        if (_.isUndefined(soloTest)) {
            soloTest = null;
            debug = true;
            fn = null;
        } else {
            if (_.isFunction(soloTest)) {
                fn = soloTest;
                soloTest = null;
                debug = true;
            } else {
                if (_.isFunction(debug)) {
                    fn = debug;
                    debug = true;
                } else {
                    if (!_.isBoolean(debug)) {
                        debug = true;
                    }
                }
            }
        }

        this._options.debug = debug;

        var wdSync = require('wd-sync'),
            runOptions = this._options[runType],
            client = wdSync.remote(runOptions.host, runOptions.port, runOptions.username, runOptions.access_key),
            steps = this._getTestFiles(),
            browser = client.browser,
            self = this,
            results = {},
            sync = client.sync;

        this._log('Running tests with environment `' + runType + '` at url: ' + runOptions.url);

        sync(function() {

            _.each(self._plugins, function(fn, name) {
                browser[name] = function() {
                    return fn.apply(browser, arguments);
                };
            });

            var _other = [];
            _.each(steps, function(v, k) {
                if (k === 'suites') {
                    return;
                }
                _other.push(v);
                delete steps[k];
            });
            steps.suites._other = _other;

            _.each(runOptions.browsers, function(browserSettings) {
                self._log('Testing with browser: ' + _.values(browserSettings).join(', '));
                _.each(steps.suites, function(suite) {
                    _.each(suite.tests, function(step) {
                        this._processTest(step, runOptions.url, soloTest, results, browser, browserSettings, suite);
                    }, self);
                });
            }, self);

            if (_.isFunction(fn)) {
                fn(results);
            }

        });

    },

    '_processTest': function(step, url, soloTest, results, browser, browserSettings, suite) {
        var test = require(step),
            baseName = path.basename(step).replace('.js', ''),
            entry;
        if (soloTest && baseName !== soloTest) {
            return;
        }
        this._log('Running test: ' + baseName);
        browser.init(browserSettings);
        browser.get(url);
        try {
            test(browser);
            this._log('Status: Pass'.green);
            entry = {
                'browser': browserSettings.browserName || '',
                'platform': browserSettings.platform || '',
                'status': 'pass',
                'message': ''
            };
        } catch(e) {
            var msg = 'Status: Fail - ' + e.message;
            this._log(msg.red);
            entry = {
                'browser': browserSettings.browserName || '',
                'platform': browserSettings.platform || '',
                'status': 'fail',
                'message': e.message
            };
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
