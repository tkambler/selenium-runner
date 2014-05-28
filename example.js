var SeleniumRunner = require('./index'),
    prettyjson = require('prettyjson'),
    seleniumRunner;

seleniumRunner = new SeleniumRunner({
    'local': {
        'url': 'http://google.com',
        'host': 'ondemand.saucelabs.com',
        'port': 80,
        'username': null,
        'access_key': null,
        'browsers': [
            {
                'platform': 'Windows 7',
                'browserName': 'Firefox',
                'browserVersion': '29'
            }
        ]
    },
    'test_dir': __dirname + '/example/tests',
    'plugin_dir': __dirname + '/example/plugins',
    'sauce': {
        'username': null,
        'password': null
    }
});

seleniumRunner.run('local', function(result) {
    result = prettyjson.render(result);
    console.log(result);
});
