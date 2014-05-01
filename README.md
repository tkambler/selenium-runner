# Selenium Runner

Selenium test runner for Node that uses fibers to create tests in a synchronous manner.

# Installation

```
$ npm install selenium-test-runner
```

# Examples

## Instantiating the Test Runner

```javascript
var SeleniumRunner = require('selenium-test-runner'),
	seleniumRunner,
	settings;
	
settings = {
	"local": {
		"host": "127.0.0.1",
		"port": 4444,
		"browsers": [
			{
				"browserName": "chrome"
			}
		]
	},
	"remote": {
        'host': 'ondemand.saucelabs.com',
        'port': 80,
        'username': 'username',
        'access_key': 'access_key',
        'browsers': [
            {
                'platform': 'Windows 7',
                'browserName': 'Internet Explorer',
                'browserVersion': '9'
            },
            {
                'platform': 'Windows 7',
                'browserName': 'Internet Explorer',
                'browserVersion': '10'
            },
            {
                'platform': 'Windows 7',
                'browserName': 'Internet Explorer',
                'browserVersion': '11'
            },
            {
                'platform': 'Windows 7',
                'browserName': 'Chrome',
                'browserVersion': '34'
            },
            {
                'platform': 'Windows 7',
                'browserName': 'Firefox',
                'browserVersion': '28'
            }
	},
	"test_dir": "./tests",
	"plugin_dir": "./plugins"
};
	
seleniumRunner = new SeleniumRunner(settings);
seleniumRunner.run(env, 'http://localhost:3000', function(result) {
    processResult(result);
    done();
});

seleniumRunner.run("local", "http://www.reddit.com", function(result) {
	console.log(result);
});
```

## Defining a Test

```javascript
module.exports = function(browser) {
    var assert = require("chai").assert;
    browser.sleep(4000);
    assert.equal(browser.title(), 'reddit: the front page of the internet');
};
```

## Defining a Plugin

With the following plugin in place, it would then be possible to call `browser.myPlugin()` in the previous example.

```javascript
module.exports = {
	'name': 'myPlugin',
	'fn': function(options) {
		// this.doSomething() === browser.doSomething() in the previous example.
		var result = true;
		return result;
	}
};
```

# License

The MIT License (MIT)

Copyright (c) 2014 Tim Ambler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
