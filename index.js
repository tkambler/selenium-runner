var _ = require('underscore'),
    path = require('path'),
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
        _.defaults(options, {
        });
        this._options = options;
    },

    '_loadPlugins': function(dir) {
        var pluginFiles = this._getPluginFiles(dir),
            wd = require('./node_modules/wd-sync/node_modules/wd/lib/main');
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

    'run': function(url, runOptions, fn) {

        var wdSync = require('wd-sync'),
            client = wdSync.remote(this._options.host, this._options.port, this._options.username, this._options.access_key),
            steps = this._getTestFiles(),
            browser = client.browser,
            self = this,
            results = {},
            sync = client.sync;

        sync(function() {

            _.each(self._plugins, function(fn, name) {
                browser[name] = function() {
                    return fn.apply(browser, arguments);
                };
            });

            _.each(steps, function(step) {
                var test = require(step),
                    baseName = path.basename(step).replace('.js', '');
                browser.init(runOptions);
                browser.get(url);
                try {
                    test(browser);
                    results[baseName] = {
                        'status': 'pass',
                        'message': ''
                    };
                } catch(e) {
                    results[baseName] = {
                        'status': 'fail',
                        'message': e.message
                    };
                }
            });

            browser.quit();

            fn(results);

        });

    },

    '_getTestFiles': function() {
        return glob.sync(path.resolve(this._options.test_dir) + '/*Test.js');
    },

    '_getPluginFiles': function(dir) {
        if (dir) {
            dir += '/*.js';
        } else {
            dir = path.resolve(this._options.plugin_dir) + '/*.js';
        }
        return glob.sync(dir);
    }

});

module.exports = SeleniumRunner;
