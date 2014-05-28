var _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    SauceLabs = require('saucelabs'),
    async = require('async'),
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
        if (!options.max_sessions) {
            options.max_sessions = 1;
        }
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

        this.api = null;
        if (this._options.sauce && this._options.sauce.username && this._options.sauce.password) {
            this.api = new SauceLabs({
                'username': this._options.sauce.username,
                'password': this._options.sauce.password
            });
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
                elapsed = moment.duration(end_ts - start_ts).humanize(),
                tasks = [];

            if (self.api) {

                _.each(results, function(suite, sk) {
                    _.each(suite, function(tests, tk) {
                        _.each(tests, function(test, tk2) {
                            tasks.push(function(cb) {

                                self.api.showJob(test.session_id, function(err, job) {
                                    if (err) {
                                        return cb(err);
                                    }
                                    self.api.createPublicLink(job.id, function(err, link) {
                                        if (err) {
                                            return cb(err);
                                        }
                                        test.public_link = link;
                                        tests[tk2] = test;
                                        cb();
                                    });
                                });

                            });
                        });
                    });
                });

            }

            async.parallel(tasks, function(err, data) {
                var finalResult = {
                    'total_tests': totalTestCount,
                    'total_browsers': totalBrowserCount,
                    'elapsed_time': elapsed,
                    'results': results
                };
                if (_.isFunction(fn)) {
                    fn(finalResult);
                }
            });

        };

        var pace = Pace(totalTestCount);

        var testTasks = [];

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
                    testTasks.push(function(cb) {
                        sync(function() {
                            self._processTest(step, runOptions.url, soloTest, results, browser, browserSettings, suite);
                            pace.op();
                            testCounter++;
                            cb();
                        });
                    });
                });
            });
        });

        async.parallelLimit(testTasks, self._options.max_sessions, function(err, data) {
            if (testCounter === totalTestCount) {
                done();
            }
        });

    },

    '_processTest': function(step, url, soloTest, results, browser, browserSettings, suite) {
        var test = require(step),
            baseName = path.basename(step).replace('.js', ''),
            entry,
            self = this;
        if (soloTest && baseName !== soloTest) {
            return;
        }
        // this._log('      Running test: ' + baseName);
        browser.init(browserSettings);
        browser.get(url);
        var status = 'failed';
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
            status = 'passed';
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

        var done = function() {
            results[suite.name][baseName].push(entry);
            browser.quit();
        };

        if (self.api) {
            entry.session_id = browser.getSessionId();
            self.api.updateJob(entry.session_id, {
            }, function() {
            });
            done();
        } else {
            done();
        }

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
    },

    '_randomString': function(length) {
        if (!length) {
            length = 10;
        }
        var result = '',
            chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (var i = length; i > 0; --i) {
            result += chars[Math.round(Math.random() * (chars.length - 1))];
        }
        return result;
    },

    '_generateTestName': function() {
        return 'test_' + moment().unix() + '_' + randomString();
    },

    '_array_chunk': function(input, size, preserve_keys) {

      //  discuss at: http://phpjs.org/functions/array_chunk/
      // original by: Carlos R. L. Rodrigues (http://www.jsfromhell.com)
      // improved by: Brett Zamir (http://brett-zamir.me)
      //        note: Important note: Per the ECMAScript specification, objects may not always iterate in a predictable order
      //   example 1: array_chunk(['Kevin', 'van', 'Zonneveld'], 2);
      //   returns 1: [['Kevin', 'van'], ['Zonneveld']]
      //   example 2: array_chunk(['Kevin', 'van', 'Zonneveld'], 2, true);
      //   returns 2: [{0:'Kevin', 1:'van'}, {2: 'Zonneveld'}]
      //   example 3: array_chunk({1:'Kevin', 2:'van', 3:'Zonneveld'}, 2);
      //   returns 3: [['Kevin', 'van'], ['Zonneveld']]
      //   example 4: array_chunk({1:'Kevin', 2:'van', 3:'Zonneveld'}, 2, true);
      //   returns 4: [{1: 'Kevin', 2: 'van'}, {3: 'Zonneveld'}]

      var x, p = '',
        i = 0,
        c = -1,
        l = input.length || 0,
        n = [];

      if (size < 1) {
        return null;
      }

      if (Object.prototype.toString.call(input) === '[object Array]') {
        if (preserve_keys) {
          while (i < l) {
            (x = i % size) ? n[c][i] = input[i] : n[++c] = {}, n[c][i] = input[i];
            i++;
          }
        } else {
          while (i < l) {
            (x = i % size) ? n[c][x] = input[i] : n[++c] = [input[i]];
            i++;
          }
        }
      } else {
        if (preserve_keys) {
          for (p in input) {
            if (input.hasOwnProperty(p)) {
              (x = i % size) ? n[c][p] = input[p] : n[++c] = {}, n[c][p] = input[p];
              i++;
            }
          }
        } else {
          for (p in input) {
            if (input.hasOwnProperty(p)) {
              (x = i % size) ? n[c][x] = input[p] : n[++c] = [input[p]];
              i++;
            }
          }
        }
      }
      return n;
    }

});

module.exports = SeleniumRunner;
