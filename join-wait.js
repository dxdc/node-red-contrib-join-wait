module.exports = function(RED) {
    'use strict';
    let jsonata = require('jsonata');

    RED.nodes.registerType('join-wait', function(config) {
        RED.nodes.createNode(this, config);

        try {
            this.pathsToWait = JSON.parse(config.paths);
            if (hasDuplicatePath(this.pathsToWait)) {
                this.error('join-wait pathsToWait cannot have duplicate entries');
                return;
            }
        } catch (err) {
            this.pathsToWait = false;
        }

        try {
            this.pathsToExpire = JSON.parse(config.pathsToExpire);
            if (hasDuplicatePath(this.pathsToExpire)) {
                this.error('join-wait pathsToExpire cannot have duplicate entries');
                return;
            }
        } catch (err) {
            this.pathsToExpire = false;
        }

        this.exactOrder = (config.exactOrder === 'true');
        this.topic = config.correlationTopic || false;
        this.topicType = config.correlationTopicType;
        if (this.topicType === 'jsonata') {
            try {
                this.topic = jsonata(this.topic);
            } catch (err) {
                this.error(`join-wait.invalid-expr ${err.message}`);
                return;
            }
        }

        this.pathTopic = config.pathTopic || 'paths';
        // this.pathTopicType = config.pathTopicType;

        this.timeout = (Number(config.timeout) || 15000) * (Number(config.timeoutUnits) || 1);
        this.firstMsg = (config.firstMsg === 'true');
        this.mapPayload = (config.mapPayload === 'true');
        this.ignoreUnmatched = config.ignoreUnmatched === true;
        this.disableComplete = config.disableComplete === true;

        this.paths = {};
        let node = this;

        node.on('close', function(removed, done) {
            for (const key in node.paths) {
                clearTimeout(node.paths[key].timeOut);
                delete node.paths[key];
            }
            done();
        });

        node.on('input', function(msg) {

            //
            // error checking
            //

            if (!msg[node.pathTopic]) {
                node.error(`join-wait "msg.${node.pathTopic}" is undefined, must be msg.${node.pathTopic}["path"]=value.`, [msg, null]);
                return;
            }

            if (typeof msg[node.pathTopic] === 'string') {
                msg[node.pathTopic] = {
                    [msg[node.pathTopic]]: true
                };
            }

            if (typeof msg[node.pathTopic] !== 'object') {
                node.error(`join-wait "msg.${node.pathTopic}" must be a string or an object, e.g., msg.${node.pathTopic}["path"] = value.`, [msg, null]);
                return;
            }

            node.pathsToWait = msg.pathsToWait || node.pathsToWait;
            if (!node.pathsToWait && !Array.isArray(node.pathsToWait)) {
                node.error('join-wait pathsToWait must be a defined array.', [msg, null]);
                return;
            }

            node.pathsToExpire = msg.pathsToExpire || node.pathsToExpire;
            if (node.pathsToExpire && !Array.isArray(node.pathsToExpire)) {
                node.error('join-wait pathsToExpire must be undefined or an array.', [msg, null]);
                return;
            }

            const pathKeys = Object.keys(msg[node.pathTopic]);
            const hasExpirePath = node.pathsToExpire && findOnePath(pathKeys, node.pathsToExpire);

            if (!hasExpirePath && !findOnePath(pathKeys, node.pathsToWait)) {
                if (!node.ignoreUnmatched) {
                    node.error(`join-wait msg.${node.pathTopic}["${pathKeys}"] doesn't exist in pathsToWait or pathsToExpire!`, [msg, null]);
                }
                return;
            }

            //
            // start processing
            //

            let topic;
            if (node.topicType === 'jsonata') {
                topic = node.topic.evaluate({
                    msg: msg
                });
            } else {
                topic = (node.topic) ? RED.util.evaluateNodeProperty(node.topic, node.topicType, node, msg) : '_join-wait-node';
            }

            if (!Object.prototype.hasOwnProperty.call(node.paths, topic)) {
                node.paths[topic] = {
                    'queue': []
                };
                makeNewTimeout(topic, node.timeout);
            }

            node.paths[topic].queue.push([Date.now(), msg]);

            if (hasExpirePath || removeExpiredByTime(topic)) {
                resetQueue(topic, true);
                return;
            }

            const pathData = getReceivedPaths(topic);
            if (findAllPaths(Object.keys(pathData), node.pathsToWait, node.exactOrder)) {
                const num = (node.firstMsg) ? 0 : node.paths[topic].queue.length - 1;
                let merged = node.paths[topic].queue[num][1];
                merged[node.pathTopic] = pathData;
                node.send([merged, null]);

                resetQueue(topic, false);
            } else if (!node.disableComplete && Object.prototype.hasOwnProperty.call(msg, 'complete')) {
                resetQueue(topic, true);
            }
        });

        function findOnePath(haystack, arr) {
        function hasDuplicatePath(arr) {
            return arr.some(function(p, index) {
                return arr.indexOf(p) !== index;
            });
        }

            return haystack.some(function(p) {
                return arr.includes(p);
            });
        }

        function findAllPaths(haystack, arr, exact) {
            const found = [];

            return arr.every(function(p, index) {
                const val = haystack.indexOf(p);
                if (val === -1) {
                    return false;
                }

                found.push(val);
                const lastIndex = index - 1;
                return (exact && lastIndex in found) ? (val > found[lastIndex]) : true;
            });
        }

        function makeNewTimeout(topic, timeout) {
            node.paths[topic].timeOut = setTimeout(function() {
                if (removeExpiredByTime(topic)) {
                    resetQueue(topic, true);
                } else {
                    const nextCheck = (node.paths[topic].queue[0][0] + node.timeout) - Date.now();
                    makeNewTimeout(topic, nextCheck);
                }
            }, timeout);
        }

        function removeExpiredByTime(topic) {
            const minStartTime = Date.now() - node.timeout;
            while (node.paths[topic].queue.length > 0 &&
                node.paths[topic].queue[0][0] < minStartTime) {
                const expired = node.paths[topic].queue.shift();
                node.send([null, expired[1]]);
            }

            return (node.paths[topic].queue.length === 0);
        }

        function getReceivedPaths(topic) {
            return node.paths[topic].queue.map(function(q) {
                if (node.mapPayload) {
                    Object.keys(q[1][node.pathTopic]).forEach(function(item) {
                        q[1][node.pathTopic][item] = q[1].payload;
                    });
                }
                return q[1][node.pathTopic];
            }).reduce(function(a, b) {
                return Object.assign(a, b);
            }, {});
        }

        function resetQueue(topic, sendExpired) {
            if (sendExpired) {
                node.paths[topic].queue.forEach(function(q) {
                    node.send([null, q[1]]);
                });
            }
            clearTimeout(node.paths[topic].timeOut);
            delete node.paths[topic];
        }
    });
};
