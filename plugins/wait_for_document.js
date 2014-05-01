/**
 * Pauses test execution until the document's `readyState` property === 'complete'.
 */
module.exports = {
    'name': 'waitForDoc',
    'fn': function(options) {

        var _ = require('underscore');

        options = options || {};
        _.defaults(options, {
            'timeout': 60000
        });

        var state, i = 0;
        while (state !== 'complete') {
            if (i === options.timeout / 1000) {
                break;
            }
            state = this.execute("return document.readyState;");
            this.sleep(1000);
            i++;
        }

        if (state === 'complete') {
            return true;
        }

        throw "Timeout occurred waiting for document.";

    }
};
