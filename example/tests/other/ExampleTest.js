module.exports = function(browser) {

    var assert = require('chai').assert;

    assert(browser.title() === 'Google', "Page title is 'Google'");

};
