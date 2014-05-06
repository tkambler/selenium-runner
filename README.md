# What is this?

> "No callbacks. No promise chains. Just pure and simple clarity."

This library provides a simple, repeatable pattern for writing and running [Selenium](http://docs.seleniumhq.org/) tests within Node that are **synchronous** in nature. No callbacks. No promise chains. Just pure and simple clarity.

# What is Selenium?

Selenium is an open-source platform that allows you to write tests that mimic real-world user interactions within a web application. Selenium accomplishes this by creating instances of real web browsers, such as Chrome, Firefox, and Internet Explorer. The tests that are written for Selenium instruct these browsers to perform one or more actions (e.g. "click this button," "fill out this form field"), at which point a certain result is verified to meet some pre-defined criteria.

The automated feedback provided by Selenium is quite useful, but if you're going to make extensive use of it, you should take great pains to ensure that your tests are both easy to write and easy to maintain. Fail to do so, and you'll quickly find yourself spending a majority of your time tweaking tests and a minority of your time actually creating a product.

# Examples

In the following example, we:

* Define a Selenium host that will run our test suite
* Define an array of browsers against which the tests will be run
* Specify the path to a folder of [test scripts](#tests). These scripts must follow a naming convention of `*Test.js`. These scripts can also be grouped within subfolders in order to create suites of related tests.
* Specify the path to a folder of [plugin scripts](#plugins). These scripts allow us to define custom actions that we can call within the browser. For example: You could define a plugin that allows you to quickly highlight the text contained within a specific element.

## Running a Test Suite Locally

```javascript
var SeleniumRunner = require("selenium-test-runner");

var runner = new SeleniumRunner({
	"local": {
		"host": "127.0.0.1",
		"port": 4444,
		"browsers": [
			{
				"browserName": "Chrome"
			}
		]
	},
    "test_dir": "./tests"
    "plugin_dir": "./plugins"
});

seleniumRunner.run("local", "http://mysite.com", null, function(result) {
	console.log(result);
});
```

## Running a Test Suite with Sauce Labs

```javascript
var SeleniumRunner = require("selenium-test-runner");

var runner = new SeleniumRunner({
	"sauce": {
		"host": "ondemand.saucelabs.com",
		"port": 80,
		"username": "username",
		"access_key": "access_key",
		"browsers": [
			{
				"platform": "Windows 7"
				"browserName": "Chrome",
				"browserVersion": "34"
			}
		]
	}
});

seleniumRunner.run("sauce", "http://mysite.com", null, function(result) {
	console.log(result);
});
```

## Running a Specific Test

The `run` method takes an optional third parameter - the name of a specific test within your `tests` directory. If specified, the runner will only run that specific test.

```javascript
seleniumRunner.run("local", "http://www.reddit.com", "TestName", function(result) {
	console.log(result);
});
```

<a name="tests"></a>
## Defining a Test

Use whatever assertion library you prefer within your tests. In the following example, we use [Chai](http://chaijs.com/).

```javascript
module.exports = function(browser) {
    var assert = require("chai").assert;
    browser.sleep(4000);
    assert.equal(browser.title(), 'reddit: the front page of the internet');
};
```

<a name="plugins"></a>
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

# Installation

```
$ npm install selenium-test-runner
```

# How do I run Selenium?

[Download Selenium](http://docs.seleniumhq.org/) or sign up for a third-party service such as [Sauce Labs](https://saucelabs.com/).

# Special Thanks To

* [node-fibers](https://github.com/laverdet/node-fibers)
* [wd-sync](https://github.com/sebv/node-wd-sync)

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
