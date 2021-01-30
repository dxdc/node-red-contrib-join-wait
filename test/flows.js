const Flows = {
    getDefault: function (options) {
        let defaultFlow = [
            {
                id: 'n1',
                type: 'join-wait',
                paths: '["path_1", "path_2", "path_3"]',
                pathsToExpire: '',
                useRegex: false,
                warnUnmatched: true,
                pathTopic: 'paths',
                pathTopicType: 'msg',
                correlationTopic: '',
                correlationTopicType: 'undefined',
                timeout: '1',
                timeoutUnits: '1000',
                exactOrder: 'false',
                firstMsg: 'true',
                mapPayload: 'true',
                disableComplete: false,
                persistOnRestart: false,
                wires: [['n2'], ['n3']],
            },
            { id: 'n2', type: 'helper' },
            { id: 'n3', type: 'helper' },
        ];

        defaultFlow[0] = Object.assign(defaultFlow[0], options);
        return defaultFlow;
    },
};

module.exports = Flows;
