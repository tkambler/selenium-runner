var SeleniumRunner = require('./index'),
    prettyjson = require('prettyjson'),
    seleniumRunner;

seleniumRunner = new SeleniumRunner({
    'local': {
        'url': 'http://google.com',
        'host': '127.0.0.1',
        'port': 4444,
        'browsers': [
            {
                'browserName': 'Chrome'
            }
        ]
    },
    'test_dir': __dirname + '/example/tests',
    'plugin_dir': __dirname + '/example/plugins'
});

seleniumRunner.run('local', function(result) {
    result = prettyjson.render(result);
    console.log(result);
});
